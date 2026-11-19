/**
 * Screenshots the playground, so its look can actually be reviewed.
 *
 * Uses playwright-core against the system Chrome, so nothing is downloaded —
 * `playwright-core` ships no browsers, and `channel: 'chrome'` borrows the one
 * already installed.
 *
 * Not part of the build or the test run: `npm run shot` on demand.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'shots');
const url = process.env.URL ?? 'http://localhost:5173/';

mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });

/** One shot, with the theme and language forced and the state set up. */
async function shoot(name, { theme, language, source, input, prepare }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Seed the page's own storage before it loads, so it starts as we want it.
  await page.addInitScript(
    ([theme, language, source, input]) => {
      localStorage.setItem('ahadu.playground.theme', theme);
      localStorage.setItem('ahadu.playground.language', language);
      if (source !== null) localStorage.setItem('ahadu.playground.source', source);
      if (input !== null) localStorage.setItem('ahadu.playground.input', input);
    },
    [theme, language, source ?? null, input ?? null],
  );

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  if (prepare) await prepare(page);

  await page.screenshot({ path: resolve(out, `${name}.png`) });
  console.log(`  ${name}.png`);
  await page.close();
}

const errorProgram = [
  '# ስተት ያለው ኮድ',
  'ሀ = 1 $ 2',
  '',
  '  ለ = 3',
  '',
  'ዕድሜ < 30 < 40',
].join('\n');

await shoot('01-dark', { theme: 'dark', language: 'am' });
await shoot('02-light', { theme: 'light', language: 'am' });
await shoot('03-english', { theme: 'dark', language: 'en' });

await shoot('04-errors-dark', {
  theme: 'dark',
  language: 'am',
  source: errorProgram,
  prepare: (page) => page.getByRole('tab', { name: /ስተቶች/ }).click(),
});

await shoot('05-errors-light', {
  theme: 'light',
  language: 'am',
  source: errorProgram,
  prepare: (page) => page.getByRole('tab', { name: /ስተቶች/ }).click(),
});

await shoot('06-tooltip', {
  theme: 'dark',
  language: 'am',
  source: errorProgram,
  // Hover the indentation error on line 4. Its span starts at column 1, so
  // the x is the editor's own padding rather than a guess at glyph widths —
  // aiming at the one-column $ on line 2 missed by a character.
  prepare: async (page) => {
    const box = await page.locator('#editor').boundingBox();
    const metrics = await page.evaluate(() => {
      const editor = document.getElementById('editor');
      const style = getComputedStyle(editor);
      return {
        lineHeight: Number.parseFloat(style.lineHeight),
        paddingTop: Number.parseFloat(style.paddingTop),
        paddingLeft: Number.parseFloat(style.paddingLeft),
      };
    });

    const line = 4;
    await page.mouse.move(
      box.x + metrics.paddingLeft + 4,
      box.y + metrics.paddingTop + (line - 0.5) * metrics.lineHeight,
    );
    await page.waitForTimeout(300);

    if (await page.locator('#tip').isHidden()) {
      throw new Error('the tooltip did not appear where an error is');
    }
  },
});

await shoot('07-tokens', {
  theme: 'dark',
  language: 'am',
  prepare: (page) => page.getByRole('tab', { name: /ቶከኖች/ }).click(),
});

await shoot('08-ast', {
  theme: 'dark',
  language: 'am',
  prepare: (page) => page.getByRole('tab', { name: /ዛፍ/ }).click(),
});

// A program that calls አንብብ, so the dialog is what Run opens.
const readsInput = [
  '# ከተጠቃሚው ግቤት መቀበል',
  'ስም = አንብብ("ስም፦ ")',
  'ጻፍ("እንደምን አለህ " + ስም + "!")',
].join('\n');

await shoot('10-input-dialog', {
  theme: 'dark',
  language: 'am',
  source: readsInput,
  input: 'ኃይለሚካኤል',
  prepare: async (page) => {
    await page.getByRole('button', { name: /አሂድ/ }).click();
    await page.waitForTimeout(300);
    if (await page.locator('#ask').isHidden()) {
      throw new Error('the input dialog did not open for a program that calls አንብብ');
    }
  },
});

await shoot('11-input-answered', {
  theme: 'light',
  language: 'en',
  source: readsInput,
  input: 'ኃይለሚካኤል',
  prepare: async (page) => {
    await page.getByRole('button', { name: /Run/ }).first().click();
    await page.waitForTimeout(250);
    // The dialog's own Run button, which starts the program.
    await page.locator('#ask-run').click();
    await page.waitForTimeout(700);
  },
});

await shoot('09-output', {
  theme: 'light',
  language: 'en',
  prepare: async (page) => {
    await page.getByRole('button', { name: /አሂድ|Run/ }).click();
    await page.waitForTimeout(700);
  },
});

await browser.close();
console.log('done');
