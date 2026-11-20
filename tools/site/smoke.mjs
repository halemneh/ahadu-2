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
