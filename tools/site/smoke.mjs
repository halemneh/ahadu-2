/**
 * Does the site actually work when served?
 *
 * The unit tests cover what the build decides; they cannot see a dev server
 * that routes a URL to the wrong file, or a bundle re-transformed into one
 * that cannot find its own worker. Both of those shipped, and both looked
 * fine from every test we had: the playground 404'd in development, and the
 * "open in playground" links carried a program the playground ignored.
 *
 * So this drives the real dev server in a real browser and asserts the three
 * things a reader does: open the playground, reach it from the nav, and send
 * a snippet to it from a lesson.
 *
 *     npm run site:smoke
 */

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const failures = [];

function check(what, got, want) {
  const ok = typeof want === 'function' ? want(got) : got === want;
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures.push(`${what}\n      got: ${JSON.stringify(got)}`);
}

const server = await createServer({
  configFile: resolve(here, 'vite.config.ts'),
  logLevel: 'error',
  server: { port: 5179 },
});
await server.listen();
const base = 'http://localhost:5179';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

const broken = [];
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) broken.push(`${r.status()} ${r.url()}`);
});
page.on('pageerror', (e) => broken.push(`pageerror: ${String(e)}`));

try {
  console.log('the playground, opened directly');
  await page.goto(`${base}/playground/`, { waitUntil: 'networkidle' });
  check('the editor is there', await page.locator('#editor').count(), 1);
  await page.locator('#run').click();
  await page.waitForTimeout(1200);
  check(
    'and a program runs in it',
    (await page.locator('#panel-output').innerText()).trim().length,
    (n) => n > 0,
  );

  console.log('the playground, from the nav');
  await page.goto(`${base}/am/`, { waitUntil: 'networkidle' });
  await page.locator('.nav a', { hasText: 'ሜዳ' }).click();
  await page.waitForTimeout(900);
  check('lands on /playground/', new URL(page.url()).pathname, '/playground/');
  check('with an editor', await page.locator('#editor').count(), 1);

  console.log('the playground as a page of the site');
  await page.goto(`${base}/en/learn/01-hello/`, { waitUntil: 'networkidle' });
  await page.locator('.sitebar .chip').last().click(); // to dark
  await page.waitForTimeout(200);
  await page.locator('.nav a', { hasText: 'Playground' }).click();
  await page.waitForTimeout(900);
  check('wears the site header', await page.locator('.sitebar .nav').count(), 1);
  check(
    'keeps the theme chosen on the lesson',
    await page.evaluate(() => document.documentElement.dataset.theme),
    'dark',
  );
  check(
    'keeps the language the lesson was read in',
    (await page.locator('#run').innerText()).includes('Run'),
    true,
  );
  check(
    'and its header links back into that language',
    await page.locator('.sitebar .nav a[data-section="learn"]').getAttribute('href'),
    '/en/learn/',
  );

  console.log('a snippet sent from a lesson');
  await page.goto(`${base}/en/learn/04-loops/`, { waitUntil: 'networkidle' });
  await page.locator('.snip-input').first().fill('ጻፍ("ከትምህርቱ"፣ 6 * 7)');
  await page.waitForTimeout(200);
  await page.locator('.snip-open').first().click();
  await page.waitForTimeout(1100);
  check(
    'arrives with the reader’s edit, not the original',
    await page.locator('#editor').inputValue(),
    'ጻፍ("ከትምህርቱ"፣ 6 * 7)',
  );
  await page.locator('#run').click();
  await page.waitForTimeout(1200);
  check(
    'and runs there',
    (await page.locator('#panel-output').innerText()).trim(),
    'ከትምህርቱ 42',
  );

  /*
   * The footer's two actions. The report link is static and the unit tests
   * cover what it says; what cannot be tested anywhere else is the dialog —
   * that it opens, that it refuses an empty message without sending anything,
   * and above all that a submission which fails leaves the reader's words
   * where they left them. The endpoint is never really called: both replies
   * are served from here, so this script sends nothing to anyone.
   */
  console.log('the footer’s two actions');
  await page.goto(`${base}/en/learn/02-variables/`, { waitUntil: 'networkidle' });
  const report = decodeURIComponent(
    (await page.locator('.foot-acts a').first().getAttribute('href')) ?? '',
  );
  check('the report link carries the page it was clicked from', report, (href) =>
    href.includes('/en/learn/02-variables/'),
  );
  check('and the language it was read in', report, (href) => href.includes('(en)'));
  check('the contact button appears once the script has wired it up', [
    await page.locator('#contact-open').isVisible(),
    await page.locator('#contact').isVisible(),
  ], (state) => state[0] === true && state[1] === false);

  await page.locator('#contact-open').click();
  check('the dialog opens', await page.locator('#contact').isVisible(), true);
  check(
    'with focus in the message field',
    await page.evaluate(() => document.activeElement?.id),
    'contact-message',
  );

  await page.locator('#contact-send').click();
  await page.waitForTimeout(200);
  check(
    'an empty message is refused here, not at the endpoint',
    (await page.locator('#contact-status').innerText()).trim(),
    'Please write a message first.',
  );

  const typed = 'The second example here prints the wrong number.';
  await page.locator('#contact-message').fill(typed);
  await page.route('https://contact.ahaducode.com/', (route) => route.abort());
  await page.locator('#contact-send').click();
  await page.waitForTimeout(500);
  check(
    'an unreachable endpoint keeps what the reader typed',
    await page.locator('#contact-message').inputValue(),
    typed,
  );
  check(
    'and says so in their language',
    (await page.locator('#contact-status').innerText()).includes('could not be sent'),
    true,
  );
  check('and offers GitHub instead', await page.locator('#contact-fallback').isVisible(), true);

  await page.unroute('https://contact.ahaducode.com/');
  await page.route('https://contact.ahaducode.com/', (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      contentType: 'application/json',
      body: '{"ok":true}',
    }),
  );
  await page.locator('#contact-send').click();
  await page.waitForTimeout(500);
  check(
    'a message that gets through is acknowledged',
    (await page.locator('#contact-status').innerText()).includes('was sent'),
    true,
  );
  check('and the form is emptied', await page.locator('#contact-message').inputValue(), '');

  await page.keyboard.press('Escape');
  check('Escape closes the dialog', await page.locator('#contact').isVisible(), false);
  check(
    'and focus goes back to the button that opened it',
    await page.evaluate(() => document.activeElement?.id),
    'contact-open',
  );

  /*
   * The two files a crawler asks for. They are generated, so in development
   * they live under /.generated/ and are rewritten into place — which is a
   * piece of config that can silently stop working, leaving them reachable in
   * dist and 404 here, or the reverse.
   */
  console.log('what a crawler is told');
  const sitemap = await page.goto(`${base}/sitemap.xml`);
  check('sitemap.xml is served', sitemap?.status(), 200);
  const xml = await page.evaluate(() => document.documentElement.outerHTML);
  check('and lists the Amharic lessons', xml, (t) => t.includes('%E1%89%B0%E1%88%9B%E1%88%AD'));
  check('and the playground', xml, (t) => t.includes('/playground/'));

  const robotsTxt = await page.goto(`${base}/robots.txt`);
  check('robots.txt is served', robotsTxt?.status(), 200);
  check(
    'and points at the sitemap',
    await robotsTxt?.text(),
    (t) => t?.includes('Sitemap: https://ahaducode.com/sitemap.xml') ?? false,
  );

  check('nothing 404ed or threw', broken, (list) => list.length === 0);
} catch (error) {
  // A page that will not load at all is a failed check, not a stack trace:
  // the point of this script is to say plainly what is broken.
  console.log('  ✗ the page could not be reached');
  failures.push(`${String(error).split('\n')[0] ?? error}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log('\nall good');
