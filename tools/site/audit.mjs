/**
 * Does the built site actually meet WCAG 2.2 AA? Measured, not asserted.
 *
 * A palette can be reasoned about on paper and still fail on the page: what
 * decides a contrast ratio is the colour a browser *paints*, after the
 * translucent `--layer` surfaces this design is built from have stacked up.
 * So this reads computed styles out of a real browser, composites the
 * backdrop behind every run of text, and reports the ratio.
 *
 * In both themes, at desktop and phone widths, it checks:
 *
 *   - contrast for every text run, against the large-text threshold where
 *     the type is big enough to earn it;
 *   - every token class on every surface a snippet is painted on, including
 *     the ones no lesson happens to use;
 *   - a visible focus indicator at every stop in the tab order;
 *   - one h1 per page and no skipped heading levels;
 *   - a name on every nav landmark, since a page carries four of them;
 *   - touch targets of at least 24px (WCAG 2.2 §2.5.8), inline links aside;
 *   - no horizontal overflow on a phone.
 *
 *     npm run site:audit        (after npm run site:build)
 *
 * Colour-blind separation is the one thing not checked here, because it is
 * not a threshold a page either meets or does not. `npm run site:cvd`
 * renders the palette through Chrome's own simulation instead, and the
 * reasoning behind the colours is in `tools/shared/tokens.css`.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer((req, res) => {
  let path = join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise((done) => server.listen(5182, done));
const base = 'http://localhost:5182';
const browser = await chromium.launch({ channel: 'chrome' });

/** Runs in the page: contrast of every rendered text run. */
const PROBE = () => {
  const parse = (css) => {
    const m = css.match(/[\d.]+/g);
    if (m === null) return [0, 0, 0, 0];
    return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
  };
  const lum = ([r, g, b]) => {
    const f = (c) => {
      const x = c / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * The opaque colour actually painted behind an element.
   *
   * Collect every painted background from the element outwards until an
   * opaque one, then composite from the bottom up. The design stacks
   * translucent `--layer` over solid shades, sometimes twice — a snippet
   * inside a diagnostic — and the ratio that matters is against what those
   * actually add up to, not against the nearest named shade.
   */
  const backdrop = (el) => {
    const stack = [];
    for (let node = el; node !== null; node = node.parentElement) {
      const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor);
      if (a === 0) continue;
      stack.push({ rgb: [r, g, b], a });
      if (a >= 0.999) break;
    }
    let out = [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const { rgb, a } = stack[i];
      out = out.map((v, k) => rgb[k] * a + v * (1 - a));
    }
    return out;
  };

  const results = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim() !== '')
      .map((n) => n.textContent.trim())
      .join(' ');
    if (text === '') continue;

    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    /*
     * The two editors are transparent textareas with a coloured copy of
     * their own text painted exactly behind them (TOOLING.md §2.1). Their
     * `color` is `transparent` on purpose; measuring it says 1:1 and means
     * nothing. What a reader actually sees is the backdrop, which is
     * measured as `.snip-backdrop` / `.backdrop` on the same pass.
     */
    if (parse(style.color)[3] === 0) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    const [fr, fg, fb, fa] = parse(style.color);
    const bg = backdrop(el);
    // Translucent text composites over its own backdrop first.
    const fore = fa >= 1 ? [fr, fg, fb] : [fr, fg, fb].map((v, i) => v * fa + bg[i] * (1 - fa));

    const size = Number.parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fore, bg);

    // The backdrop is part of the key: the same colour on three different
    // surfaces is three different ratios, and the worst of them is the one
    // that decides whether the palette passes.
    const key = `${el.className}|${style.color}|${style.fontSize}|${bg.join()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      what: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
      sample: text.slice(0, 24),
      size,
      weight,
      got: Math.round(got * 100) / 100,
      need,
      ok: got >= need - 0.005,
    });
  }
  return results;
};

/** Runs in the page: heading order, landmarks, touch targets. */
const STRUCTURE = () => {
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
    Number(h.tagName[1]),
  );
  const jumps = [];
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) jumps.push(`${headings[i - 1]} → ${headings[i]}`);
  }

  const landmarks = [...document.querySelectorAll('header,nav,main,footer,aside,[role=region]')].map(
    (el) => ({
      tag: el.tagName.toLowerCase(),
      label: el.getAttribute('aria-label') ?? '',
    }),
  );

  const small = [];
  for (const el of document.querySelectorAll('a[href], button:not([hidden]), summary, select')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    // Targets inside a sentence are exempt (WCAG 2.2 §2.5.8, "inline").
    if (el.closest('p, li, .summary') !== null && el.tagName === 'A') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.width < 24 || r.height < 24) {
      small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }

  return { h1s: headings.filter((h) => h === 1).length, jumps, landmarks, small };
};

async function focusWalk(page, limit = 40) {
  const bad = [];
  const seen = new Set();
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      const s = getComputedStyle(el);
      const name =
        el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
      const outline =
        s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0
          ? `outline ${s.outlineWidth}`
          : '';
      const shadow = s.boxShadow !== 'none' ? 'box-shadow' : '';
      return { name, indicator: [outline, shadow].filter(Boolean).join(' + ') };
    });
    if (stop === null) break;
    if (seen.has(stop.name)) continue;
    seen.add(stop.name);
    if (stop.indicator === '') bad.push(stop.name);
  }
  return { stops: [...seen], bad };
}

const PAGES = [
  ['home am', '/am/'],
  ['lesson en', '/en/learn/03-conditions/'],
  ['lesson am', '/am/%E1%89%B0%E1%88%9B%E1%88%AD/04-%E1%8B%91%E1%8B%B0%E1%89%B5/'],
  ['reference en', '/en/reference/'],
  ['examples en', '/en/examples/'],
  ['playground', '/playground/'],
];

let failures = 0;
const worst = [];

for (const theme of ['dark', 'light']) {
  console.log(`\n================ ${theme} ================`);
  for (const [name, path] of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript((t) => localStorage.setItem('ahadu.theme', t), theme);
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const rows = await page.evaluate(PROBE);
    const bad = rows.filter((r) => !r.ok);
    for (const r of rows) worst.push({ theme, page: name, ...r });
    failures += bad.length;
    console.log(
      `  ${bad.length === 0 ? '✓' : '✗'} ${name.padEnd(14)} ${rows.length} text runs, ${bad.length} below AA`,
    );
    for (const r of bad) {
      console.log(`      ${r.what} "${r.sample}" ${r.got} < ${r.need} (${r.size}px/${r.weight})`);
    }

    const s = await page.evaluate(STRUCTURE);
    if (s.h1s !== 1) {
      console.log(`      ! ${s.h1s} h1 elements`);
      failures += 1;
    }
    if (s.jumps.length > 0) {
      console.log(`      ! heading level jumps: ${s.jumps.join(', ')}`);
      failures += 1;
    }
    const unnamed = s.landmarks.filter((l) => l.tag === 'nav' && l.label === '');
    if (unnamed.length > 0) {
      console.log(`      ! ${unnamed.length} unnamed nav landmark(s)`);
      failures += 1;
    }
    if (s.small.length > 0) {
      console.log(`      ! targets under 24px: ${s.small.join(', ')}`);
      failures += 1;
    }

    const focus = await focusWalk(page);
    if (focus.bad.length > 0) {
      console.log(`      ! no focus indicator: ${focus.bad.join(', ')}`);
      failures += 1;
    } else {
      console.log(`      focus: ${focus.stops.length} distinct stops, all visible`);
    }

    await page.close();
  }
}

/*
 * The same checks at a phone width, with the drawer open — which is a
 * surface and a set of targets that exist nowhere else.
 */
console.log('\n================ 390px, drawer open ================');
for (const theme of ['dark', 'light']) {
  for (const [name, path] of [
    ['home am', '/am/'],
    ['lesson en', '/en/learn/03-conditions/'],
    ['reference en', '/en/reference/'],
    ['playground', '/playground/'],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await page.addInitScript((t) => localStorage.setItem('ahadu.theme', t), theme);
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.locator('#menu').click();
    await page.waitForTimeout(350);

    const rows = await page.evaluate(PROBE);
    const bad = rows.filter((r) => !r.ok);
    failures += bad.length;
    const s = await page.evaluate(STRUCTURE);
    if (s.small.length > 0) failures += 1;
    console.log(
      `  ${bad.length === 0 && s.small.length === 0 ? '✓' : '✗'} ${theme} ${name.padEnd(14)} ${bad.length} below AA, ${s.small.length} target(s) under 24px`,
    );
    for (const r of bad) console.log(`      ${r.what} "${r.sample}" ${r.got} < ${r.need}`);
    for (const t of s.small) console.log(`      ${t}`);

    // No horizontal overflow: a page that scrolls sideways on a phone is a
    // page whose lines are cut off.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) {
      console.log(`      ! ${overflow}px of horizontal overflow`);
      failures += 1;
    }
    await page.close();
  }
}

/*
 * Every token class, on every surface a snippet is ever painted on.
 *
 * The pages above only exercise the classes their lessons happen to use —
 * nothing on the site nests three brackets deep, and no lesson uses a
 * reserved word. This paints one of each on each surface and measures it, so
 * the ladder in tokens.css is checked rather than asserted.
 */
const TOKEN_CLASSES = [
  'tk-kw',
  'tk-type',
  'tk-lit',
  'tk-reserved',
  'tk-id',
  'tk-str',
  'tk-num',
  'tk-op',
  'tk-then',
  'tk-stop',
  'tk-sep',
  'tk-punct',
  'tk-comment',
  'tk-br0',
  'tk-br1',
  'tk-br2',
];

console.log('\n---- every token class, on every code surface ----');
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript((t) => localStorage.setItem('ahadu.theme', t), theme);
  await page.goto(`${base}/en/learn/03-conditions/`, { waitUntil: 'networkidle' });
  await page.evaluate((classes) => {
    const host = document.createElement('div');
    host.id = 'audit-swatches';
    /*
     * Three surfaces, because a token colour has to clear AA on all of
     * them: the page itself (the editor), a snippet's own shade, and a
     * layer over that shade — which is the code quoted inside a diagnostic,
     * and the hardest of the three in both themes.
     */
    host.innerHTML = [
      '<div style="background:var(--bg)"></div>',
      '<div style="background:var(--surface-1)"></div>',
      '<div style="background:var(--surface-1)"><div style="background:var(--layer)"></div></div>',
    ].join('');
    for (const slot of host.querySelectorAll('div:not(:has(div))')) {
      slot.innerHTML = classes
        .map((c) => `<pre style="margin:0"><code><span class="${c}">ሀለሐ</span></code></pre>`)
        .join('');
    }
    document.body.append(host);
  }, TOKEN_CLASSES);

  const rows = (await page.evaluate(PROBE)).filter((r) => r.what.startsWith('span.tk-'));
  await page.evaluate(() => document.getElementById('audit-swatches')?.remove());

  console.log(`  ${theme}:`);
  for (const r of rows.sort((a, b) => a.got - b.got)) {
    console.log(`    ${r.ok ? ' ' : '!'} ${r.what.padEnd(22)} ${String(r.got).padStart(6)}`);
    if (!r.ok) failures += 1;
  }
  await page.close();
}

// The table for the report: the lowest ratio seen for each role.
const byRole = new Map();
for (const r of worst) {
  const key = `${r.theme}|${r.what}`;
  const prev = byRole.get(key);
  if (prev === undefined || r.got < prev.got) byRole.set(key, r);
}
console.log('\n---- lowest ratio seen, per element role ----');
for (const [key, r] of [...byRole.entries()].sort()) {
  console.log(`  ${key.padEnd(40)} ${String(r.got).padStart(6)}  need ${r.need}`);
}

await browser.close();
server.close();
console.log(failures === 0 ? '\nno findings' : `\n${failures} finding(s)`);
