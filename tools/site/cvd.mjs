/**
 * Shows the highlighting as a colour-blind reader sees it.
 *
 * The syntax colours in `tools/shared/tokens.css` were solved so that no
 * category a reader has to tell apart is separated by hue alone: the ones
 * that could be confused are spread along a luminance ladder, and each
 * carries a weight or a style of its own. That is an argument, and an
 * argument about what something looks like should be settled by looking.
 *
 * So this paints one of every token class and photographs it through
 * Chrome's `Emulation.setEmulatedVisionDeficiency` — an implementation
 * entirely separate from the Machado matrices the palette was solved
 * against, which makes agreeing with it a cross-check rather than the same
 * arithmetic run twice. `achromatopsia` is the one that matters most: it is
 * the palette with every hue taken away, and the code should still read.
 *
 *     npm run site:cvd          (after npm run site:build)
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'dist');
const out = resolve(process.argv[2] ?? resolve(here, 'shots/cvd'));
mkdirSync(out, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
/*
 * Confined to the built site, and reachable only from this machine.
 *
 * `join(root, url)` is not a confinement: an encoded parent segment such as
 * `/%2e%2e%2f` resolves outside `root`, and the server would then stream
 * whatever it found. Harmless-looking in a screenshot script, except that it
 * listened on every interface, so anyone who could reach the port while a
 * shot was being taken could read files from the machine.
 */
const server = createServer((req, res) => {
  const asked = resolve(root, `.${decodeURIComponent((req.url ?? '/').split('?')[0])}`);
  if (asked !== root && !asked.startsWith(root + sep)) {
    res.writeHead(403).end('outside the site');
    return;
  }
  const path = existsSync(asked) && statSync(asked).isDirectory() ? join(asked, 'index.html') : asked;
  if (!existsSync(path)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise((done) => server.listen(5183, '127.0.0.1', done));
const base = 'http://localhost:5183';
const browser = await chromium.launch({ channel: 'chrome' });

/*
 * A program written to put every token class on screen at once: keywords,
 * a type keyword, the three literals, a reserved word, a string, numbers,
 * operators, all three Ethiopic marks, a comment, and brackets three deep.
 * It is never run — it is a picture of the palette.
 */
const SAMPLE = [
  '# አስተያየት — ይህ ኮድ ለቀለም ማሳያ ነው',
  'ቁጥር ዕድሜ = 20',
  'ስም = "ሰላም ዓለም"',
  'ዝርዝር = [1፣ 2፣ ድምር(ከፍተኛው([3፣ 4])፣ 5)]',
  'ዕድሜ >= 18 እና ስም != "" ከሆነ፦',
  '    ጻፍ("ትልቅ"፣ እውነት፣ ሐሰት፣ ምንም)።',
  'አለበለዚያ፦',
  '    ጻፍ(ዕድሜ * 2 + 1)',
];

async function shoot(theme, kind) {
  const page = await browser.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 2 });
  await page.addInitScript((t) => localStorage.setItem('ahadu.theme', t), theme);
  await page.goto(`${base}/playground/`, { waitUntil: 'networkidle' });
  await page.locator('#editor').fill(SAMPLE.join('\n'));
  await page.waitForTimeout(500);
  // Put the caret beside a bracket, so the matched pair is in the picture.
  await page.evaluate(() => {
    const el = document.getElementById('editor');
    const at = el.value.indexOf('ድምር(') + 4;
    el.focus();
    el.setSelectionRange(at, at);
    el.dispatchEvent(new Event('select', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: kind });

  const box = await page.locator('.editor-wrap').boundingBox();
  await page.screenshot({ path: resolve(out, `${theme}-${kind}.png`), clip: box });
  console.log(`  ${theme}-${kind}.png`);
  await page.close();
}

for (const theme of ['dark', 'light']) {
  for (const kind of ['none', 'deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia']) {
    await shoot(theme, kind);
  }
}

await browser.close();
server.close();
console.log('done');
