/**
 * Is the published site still up, and still whole?
 *
 * `smoke.mjs` drives a dev server before a deploy; the unit tests check what
 * the build decides. Neither can see the thing that actually takes a teaching
 * site off the air: it was fine when it shipped and something outside this
 * repository changed afterwards. A certificate lapses. Nameservers move and
 * the apex stops resolving (DEPLOY.md keeps a whole section on that, because
 * the DNS zone sits on a subscription that could expire). GitHub clears the
 * custom domain because a deploy went out without `CNAME`. The playground's
 * bundle is served but the worker chunk it names is not, so the Run button
 * does nothing. Every one of those leaves a green tick on the last commit.
 *
 * So this asks the live site the questions a reader would, from outside:
 *
 *     node tools/site/health.mjs
 *     node tools/site/health.mjs --base https://example.com   # try a failure
 *     node tools/site/health.mjs --skip-external              # faster locally
 *
 * Internal breakage fails the run. External links only warn: a link to
 * someone else's site going down is their outage, and a red tick that means
 * "a third party is having a bad day" is a tick nobody reads twice.
 *
 * This is not telemetry and SITE.md §6.1 is not bent by it. That rule governs
 * what a page requests when a reader opens it; nothing here runs in a
 * reader's browser, nothing is recorded about anybody, and the only thing
 * learned is whether the site answers.
 */

import { connect } from 'node:tls';

/** Where the site lives. Mirrors SITE_ORIGIN in build/contact.ts. */
export const SITE = 'https://ahaducode.com';

/** The one endpoint the site knows about. Mirrors CONTACT_ENDPOINT. */
export const CONTACT = 'https://contact.ahaducode.com/';

/**
 * Every URL a reader can reach without following a link from somewhere else:
 * the root, both languages, every section of each, and the playground.
 *
 * Written out rather than derived, because the point is to catch a section
 * that moved. A list generated from `shared/nav.ts` would move with it and
 * agree with a site that had just lost a page. `tests/unit/site/health.test.ts`
 * holds the two together instead: rename a section there and the test fails
 * with the instruction to update this list, which is a sentence in a test
 * rather than a silent gap in the monitoring.
 */
export const REQUIRED_PATHS = [
  '/',
  '/am/',
  '/am/ተማር/',
  '/am/ማጣቀሻ/',
  '/am/ምሳሌዎች/',
  '/am/ግላዊነት/',
  '/en/',
  '/en/learn/',
  '/en/reference/',
  '/en/examples/',
  '/en/privacy/',
  '/playground/',
];

/**
 * Days of certificate left before this is a failure rather than a note.
 *
 * Let's Encrypt certificates last 90 days and GitHub renews them around 30
 * days out. Three weeks is late enough that renewal has demonstrably not
 * happened and early enough that there is still a working site in which to
 * fix it.
 */
export const CERT_FAILS_WITHIN_DAYS = 21;

/** How long to wait on any one request before calling it unreachable. */
const TIMEOUT_MS = 20_000;

/** How many requests at once. Polite to the host, and to other people's. */
const AT_ONCE = 6;

/**
 * Said to every server this script talks to, so an operator reading a log can
 * see what asked and go and look at it. Named after the project, not the
 * person running it.
 */
const USER_AGENT = 'ahadu-site-health-check (+https://github.com/halemneh/ahadu-2)';

// ---------------------------------------------------------------------------
// Reading a page. Pure, so the tests can be about the parsing and not the net.
// ---------------------------------------------------------------------------

/**
 * The target of a page's `<meta http-equiv="refresh">`, or null if it has none.
 *
 * The root page is nothing but this redirect: GitHub Pages has no `_redirects`
 * and no equivalent, so a meta refresh is the only reason `/` reaches `/am/`
 * (DEPLOY.md). A root that returns 200 is therefore not enough to know the
 * site's front door works — the 200 is also what a root with the redirect
 * stripped out would return.
 *
 * @param {string} html
 * @returns {string | null}
 */
export function metaRefreshTarget(html) {
  const tag = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/i.exec(html);
  if (!tag) return null;
  const content = /content=["']([^"']+)["']/i.exec(tag[0]);
  if (!content) return null;
  const url = /url\s*=\s*(.+)$/i.exec(content[1].trim());
  return url ? url[1].trim() : null;
}

/**
 * The `src` of every `<script type="module">` on a page.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function moduleScripts(html) {
  return [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .filter((m) => /type=["']module["']/i.test(m[0]))
    .map((m) => m[1]);
}

/**
 * The worker chunks a built bundle names, as paths.
 *
 * Vite rewrites `new Worker(new URL(...))` to a hashed filename, and the
 * playground is useless without it: the page loads, the editor appears, and
 * Run silently does nothing. Finding nothing here is itself a failure — it
 * means the bundle no longer knows about its worker at all.
 *
 * @param {string} js
 * @returns {string[]}
 */
export function workerAssets(js) {
  return [...new Set(js.match(/\/playground\/assets\/worker-[A-Za-z0-9_-]+\.js/g) ?? [])];
}

/**
 * Every href and src on a page, resolved against the page's own URL.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @returns {string[]}
 */
export function links(html, pageUrl) {
  /** @type {string[]} */
  const found = [];
  for (const [, value] of html.matchAll(/(?:href|src)=["']([^"']*)["']/gi)) {
    const raw = decodeEntities(value.trim());
    // A bare fragment is this page again; mailto: and the like are not pages
    // at all. Everything else is either relative or already http(s).
    if (raw === '' || raw.startsWith('#')) continue;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
    if (scheme && !/^https?$/i.test(scheme[1])) continue;
    try {
      found.push(new URL(raw, pageUrl).href);
    } catch {
      // A href that is not a URL is a bug in the page, but not this script's
      // to report: the build's own tests know what it meant to write.
    }
  }
  return [...new Set(found)];
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&#38;/g, '&');
}

/**
 * How two URLs are judged to be the same request.
 *
 * The fragment never reaches a server, so `/playground/#program` and
 * `/playground/` are one check. For somebody else's site the query goes too:
 * every page of this site carries a pre-filled `issues/new?title=…&body=…`
 * link, and those are thirty-odd distinct URLs that are one GitHub page. One
 * request answers for all of them, and asking thirty times each run would be
 * rude for no extra information.
 *
 * @param {string} url
 * @param {string} [origin]
 * @returns {string}
 */
export function requestKey(url, origin = SITE) {
  const parsed = new URL(url);
  const internal = parsed.origin === new URL(origin).origin;
  return internal
    ? `${parsed.origin}${parsed.pathname}${parsed.search}`
    : `${parsed.origin}${parsed.pathname}`;
}

/**
 * Is this URL part of the site, rather than somebody else's?
 *
 * @param {string} url
 * @param {string} [origin]
 * @returns {boolean}
 */
export function isInternal(url, origin = SITE) {
  return new URL(url).origin === new URL(origin).origin;
}

/**
 * Whole days from `now` until `validTo`, as a certificate states it.
 *
 * @param {string} validTo
 * @param {number} [now]
 * @returns {number | null}
 */
export function certificateDaysLeft(validTo, now = Date.now()) {
  const expires = Date.parse(validTo);
  if (Number.isNaN(expires)) return null;
  return Math.floor((expires - now) / 86_400_000);
}

/**
 * Is there enough certificate left not to need telling about?
 *
 * @param {string} validTo
 * @param {number} [now]
 * @returns {boolean}
 */
export function certificateOk(validTo, now = Date.now()) {
  const days = certificateDaysLeft(validTo, now);
  return days !== null && days >= CERT_FAILS_WITHIN_DAYS;
}

/**
 * Is this body the healthy answer from the contact endpoint to a GET?
 *
 * @param {string} body
 * @returns {boolean}
 */
export function isContactAlive(body) {
  try {
    const reply = JSON.parse(body);
    // The endpoint takes POST and nothing else, so refusing the method *is*
    // the proof it is running and routing. A cron must never POST here: the
    // Worker mails the maintainer, and a monitor that sends mail every hour
    // is a monitor that gets filtered.
    return reply.ok === false && reply.error === 'method';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Asking the network.
// ---------------------------------------------------------------------------

/**
 * The `<loc>` paths out of a sitemap.
 *
 * Paths, not the URLs as written: a sitemap states absolute production URLs,
 * and `--base` exists so this script can be pointed at a dev server. Comparing
 * what comes back against the base being checked keeps both honest.
 */
export function sitemapPaths(body) {
  return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].flatMap((m) => {
    try {
      return [new URL(decodeEntities(m[1] ?? '')).pathname];
    } catch {
      return [];
    }
  });
}

async function get(url, { method = 'GET' } = {}) {
  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = method === 'GET' ? await response.text() : '';
    return { status: response.status, body, url: response.url };
  } catch (error) {
    return { status: 0, body: '', url, error: String(error).split('\n')[0] };
  }
}

/** The certificate the host presents, having first insisted it is trusted. */
async function certificate(host) {
  return new Promise((resolve, reject) => {
    // rejectUnauthorized is on by default, so an expired certificate, a wrong
    // name or a broken chain arrives here as a connection error rather than as
    // a certificate to inspect. That is the "is it valid" half of the check.
    const socket = connect({ host, port: 443, servername: host }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert);
    });
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error('timed out')));
    socket.on('error', reject);
  });
}

async function inParallel(items, worker) {
  const results = [];
  const queue = [...items];
  const runners = Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      results.push(await worker(next));
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------

const failures = [];
const warnings = [];

/**
 * `why` is what went wrong, and is shown only when something did. A passing
 * run should read as a list of plain statements: anything a green line says
 * is noise the next reader has to decide to ignore.
 */
function check(what, ok, why) {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${!ok && why ? ` — ${why}` : ''}`);
  if (!ok) failures.push(why ? `${what} — ${why}` : what);
}

function warn(what) {
  console.log(`  ⚠ ${what}`);
  warnings.push(what);
}

async function main(argv) {
  const base = argValue(argv, '--base') ?? SITE;
  const skipExternal = argv.includes('--skip-external');
  const origin = new URL(base).origin;

  console.log(`${origin} — health check\n`);

  console.log('the pages a reader can arrive at');
  const pages = new Map();
  for (const path of REQUIRED_PATHS) {
    const url = new URL(path, base).href;
    const response = await get(url);
    pages.set(requestKey(url, origin), response);
    check(`${path} is 200`, response.status === 200, describe(response));
  }

  const root = pages.get(requestKey(new URL('/', base).href, origin));
  const refresh = root ? metaRefreshTarget(root.body) : null;
  check(
    '/ still carries its meta refresh to /am/',
    refresh === '/am/',
    refresh === null ? 'no meta refresh on the root page' : `points at ${refresh}`,
  );

  console.log('\nthe playground');
  const playground = pages.get(requestKey(new URL('/playground/', base).href, origin));
  const bundles = playground ? moduleScripts(playground.body) : [];
  check('its page names a module bundle', bundles.length > 0);
  for (const src of bundles) {
    const bundle = await get(new URL(src, base).href);
    check(`${src} is served`, bundle.status === 200, describe(bundle));
    if (bundle.status !== 200) continue;
    const workers = workerAssets(bundle.body);
    check(
      'the bundle still names its worker',
      workers.length > 0,
      workers.length === 0 ? 'nothing matching /playground/assets/worker-*.js in it' : undefined,
    );
    for (const path of workers) {
      const worker = await get(new URL(path, base).href);
      check(`${path} is served`, worker.status === 200, describe(worker));
    }
  }

  /*
   * The two files a search engine reads. They are the site's only route to a
   * reader who does not already know it exists, and they fail in the quietest
   * way there is: a sitemap that 404s costs nothing today and costs every
   * Amharic search result three months from now. Nobody opens these by hand,
   * so nobody would notice.
   */
  console.log('\nwhat a crawler is told');
  const sitemap = await get(new URL('/sitemap.xml', base).href);
  check('/sitemap.xml is served', sitemap.status === 200, describe(sitemap));
  const listed = sitemap.status === 200 ? sitemapPaths(sitemap.body) : [];
  check('and lists pages', listed.length > 0, listed.length === 0 ? 'no <loc> in it' : undefined);

  if (listed.length > 0) {
    const results = await inParallel(listed, async (path) => ({
      path,
      ...(await get(new URL(path, base).href)),
    }));
    const dead = results.filter((r) => r.status !== 200);
    check(
      `every one of its ${listed.length} URLs is 200`,
      dead.length === 0,
      dead.map((r) => `${describe(r)} ${r.path}`).join('; '),
    );
  }

  const robotsTxt = await get(new URL('/robots.txt', base).href);
  check('/robots.txt is served', robotsTxt.status === 200, describe(robotsTxt));
  check(
    'and points at the sitemap',
    robotsTxt.status === 200 && /^Sitemap:\s*\S+/m.test(robotsTxt.body),
    robotsTxt.status === 200 ? 'no Sitemap: line' : undefined,
  );

  console.log('\nthe certificate');
  await checkCertificate(base);

  console.log('\nthe contact endpoint');
  // Not derived from `--base`: the endpoint is a Worker on its own subdomain,
  // deployed by hand and quite separate from the site (DEPLOY.md), so there is
  // one of it however the site is being served.
  const contact = await get(CONTACT);
  check(
    'answers a GET by refusing the method',
    isContactAlive(contact.body),
    `${contact.status} ${contact.error ?? contact.body.trim().slice(0, 120)}`,
  );

  console.log('\nlinks');
  const { internal, external, broken } = await crawl(base, origin, pages);
  check(
    `no broken internal links (${internal} URLs reached)`,
    broken.length === 0,
    broken.length > 0 ? broken.join('; ') : undefined,
  );

  if (skipExternal) {
    console.log(`  · ${external.length} external pages not checked (--skip-external)`);
  } else {
    const results = await inParallel(external, async (url) => ({ url, ...(await get(url)) }));
    const bad = results.filter((r) => r.status === 0 || r.status >= 400);
    for (const r of bad) warn(`${describe(r)} ${r.url}`);
    console.log(
      `  ${bad.length === 0 ? '✓' : '·'} ${external.length} external pages, ` +
        `${bad.length} unreachable (a warning, not a failure)`,
    );
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:\n  - ${failures.join('\n  - ')}`);
    return 1;
  }
  console.log(warnings.length > 0 ? `all good (${warnings.length} warning(s))` : 'all good');
  return 0;
}

async function checkCertificate(base) {
  const { hostname, protocol } = new URL(base);
  if (protocol !== 'https:') {
    // Only so that `--base` can be pointed at a dev server while working on
    // this script. The live site is https, where the check below does run.
    console.log(`  · ${base} is not https, so there is no certificate to check`);
    return;
  }
  try {
    const cert = await certificate(hostname);
    const days = certificateDaysLeft(cert.valid_to);
    check(
      days === null
        ? `${hostname} presents a certificate with no readable expiry`
        : `${hostname} has ${days} days of certificate left (expires ${cert.valid_to})`,
      certificateOk(cert.valid_to),
      `fewer than ${CERT_FAILS_WITHIN_DAYS} days left; renewal has not happened`,
    );
  } catch (error) {
    check(`${hostname} presents a valid certificate`, false, String(error).split('\n')[0]);
  }
}

/**
 * Walk the site from its root, following only its own links.
 *
 * The required paths above are the front doors; this finds the lessons behind
 * them, which is where a broken link actually hurts — a reader on lesson four
 * following "next" into a 404 has no way to tell a missing page from the end
 * of the course.
 */
async function crawl(base, origin, pages) {
  const seen = new Set(pages.keys());
  const queue = [...pages].filter(([, r]) => r.status === 200 && isHtml(r.body));
  // Keyed, so each external page is asked once however many links reach it.
  const external = new Map();
  const internal = new Set(seen);
  const broken = [];

  while (queue.length > 0) {
    const [, page] = queue.shift();
    for (const href of links(page.body, page.url)) {
      const key = requestKey(href, origin);
      if (!isInternal(href, origin)) {
        if (!external.has(key)) external.set(key, href);
        continue;
      }
      internal.add(key);
      if (seen.has(key)) continue;
      seen.add(key);
      const response = await get(href);
      pages.set(key, response);
      if (response.status !== 200) {
        broken.push(`${describe(response)} ${href}`);
        continue;
      }
      if (isHtml(response.body)) queue.push([key, response]);
    }
  }

  return { internal: internal.size, external: [...external.values()], broken };
}

function isHtml(body) {
  return /<html[\s>]/i.test(body);
}

function describe(response) {
  return response.error ?? String(response.status);
}

function argValue(argv, flag) {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
}

// Run only when invoked, so the tests can import the parsing above without
// the script going and asking the internet anything.
if (process.argv[1]?.endsWith('health.mjs')) {
  process.exitCode = await main(process.argv.slice(2));
}
