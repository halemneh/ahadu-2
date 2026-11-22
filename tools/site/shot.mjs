/**
 * Screenshots the site, the way tools/playground/shot.mjs does the playground.
 *
 * Serves the built `dist/` over HTTP rather than from a file path, because the
 * pages link to each other with absolute URLs — `/am/ተማር/` means nothing to a
 * `file://` browser.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'dist');
const out = resolve(here, 'shots');
mkdirSync(out, { recursive: true });

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

await new Promise((done) => server.listen(5180, done));
const base = 'http://localhost:5180';
const browser = await chromium.launch({ channel: 'chrome' });

async function shoot(name, path, { theme = 'dark', full = false, prepare } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((t) => localStorage.setItem('ahadu.theme', t), theme);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (prepare) await prepare(page);
  await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: full });
  console.log(`  ${name}.png`);
  await page.close();
}

await shoot('01-home-am', '/am/', { theme: 'dark' });
await shoot('02-home-en', '/en/', { theme: 'light' });
await shoot('03-lesson-am', '/am/%E1%89%B0%E1%88%9B%E1%88%AD/01-%E1%88%B0%E1%88%8B%E1%88%9D/');
await shoot('04-lesson-en', '/en/learn/01-hello/', { theme: 'light' });
await shoot('05-reference', '/en/reference/', { theme: 'dark' });
await shoot('06-examples', '/en/examples/', { theme: 'light' });

// A snippet the reader has edited and run: the page's main interaction.
await shoot('07-snippet-run', '/en/learn/01-hello/', {
  theme: 'dark',
  prepare: async (page) => {
    const area = page.locator('.snip-input').first();
    await area.fill('ጻፍ("ሰላም"፣ 2 + 3)');
    await page.locator('.snip-run').first().click();
    await page.waitForTimeout(400);
    const text = await page.locator('.snip-out').first().innerText();
    if (!text.includes('5')) throw new Error(`snippet did not run: ${text}`);
  },
});

/*
 * The contact dialog, in both themes. It is the one piece of the site that
 * floats above the page: a shadow and a translucent backdrop are all that say
 * so, and whether that reads at all is something only a picture shows.
 *
 * The endpoint is never really called. The third shot aborts the request from
 * here, and it is the state most worth looking at — the reader's words still
 * in the box, and a way out of it underneath.
 */
const ENDPOINT = 'https://contact.ahaducode.com/';

async function openContact(page, typed) {
  await page.locator('#contact-open').click();
  await page.locator('#contact-message').fill(typed);
  await page.waitForTimeout(200);
}

await shoot('08-contact-am', '/am/', {
  theme: 'dark',
  prepare: (page) => openContact(page, 'በትምህርት ሁለት ላይ ያለው ውጤት የተሳሳተ ይመስለኛል።'),
});

await shoot('09-contact-en', '/en/', {
  theme: 'light',
  prepare: (page) => openContact(page, 'The second example in lesson two prints the wrong number.'),
});

await shoot('10-contact-failed', '/en/learn/02-variables/', {
  theme: 'dark',
  prepare: async (page) => {
    await page.route(ENDPOINT, (route) => route.abort());
    await openContact(page, 'The second example in lesson two prints the wrong number.');
    await page.locator('#contact-send').click();
    await page.waitForTimeout(600);
    const said = await page.locator('#contact-status').innerText();
    if (!said.includes('could not be sent')) throw new Error(`no failure message: ${said}`);
  },
});

await browser.close();
server.close();
console.log('done');
