/**
 * What the site needs a browser for (SITE.md §4.2).
 *
 * Everything a reader reads is in the HTML already: the prose, the samples,
 * their highlighting, and the output the build verified. This script adds the
 * part that cannot be static — editing a sample and running it — plus the
 * theme toggle.
 *
 * Snippets run **inline**, not in a worker. The playground uses one because a
 * program there may be anything and an endless loop would freeze the tab; here
 * the step budget turns that same loop into `AH3018`, which is a better lesson
 * than a hung page, and it arrives in milliseconds. It also means a lesson
 * page bundles no worker.
 *
 * The contact dialog is the one thing here that can reach the network, and it
 * does so only when the reader presses Send (SITE.md §6). Nothing in this file
 * makes a request on load.
 */

import { tokenize } from '../../../src/lexer/index.js';
import { highlight } from '../../playground/highlight.js';
import { evaluate } from '../../playground/evaluate.js';
import { escapeHtml } from '../../playground/view.js';
import { formatDiagnostic } from '../../../src/diagnostics.js';
import { encodeProgram } from '../../shared/share.js';
import { setUpMenu } from '../../shared/menu.js';
import { setUpSearch } from '../../shared/search.js';
import { setUpContact } from '../../shared/contact-dialog.js';

/** Smaller than the playground's: a lesson's program should be quick. */
const MAX_STEPS = 500_000;

const THEME_KEY = 'ahadu.theme';

function setUpTheme(): void {
  const button = document.getElementById('theme');
  if (!(button instanceof HTMLButtonElement)) return;

  button.addEventListener('click', () => {
    const root = document.documentElement;
    const dark =
      root.dataset.theme === undefined
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : root.dataset.theme === 'dark';
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // A reader with storage blocked still gets the theme for this page.
    }
  });
}

/** Re-paints the backdrop under a snippet's textarea. */
function repaint(snippet: HTMLElement, source: string, caret: number | null = null): void {
  const backdrop = snippet.querySelector('.snip-backdrop code');
  if (!(backdrop instanceof HTMLElement)) return;
  const { tokens, diagnostics } = tokenize(source);
  backdrop.innerHTML = highlight({ source, tokens, diagnostics, caret });
}

/** Brackets, whose pairs light up when the caret is beside one. */
const BRACKET_CHARS = '()[]';

function besideBracket(value: string, at: number): boolean {
  return BRACKET_CHARS.includes(value[at - 1] ?? '') || BRACKET_CHARS.includes(value[at] ?? '');
}

function runSnippet(snippet: HTMLElement, source: string): void {
  const out = snippet.querySelector('.snip-out');
  if (!(out instanceof HTMLElement)) return;

  const input = (snippet.dataset.input ?? '').split('\n').filter((line) => line !== '');
  // The clock, as the playground does. `evaluate` defaults both to fixed
  // values so the build can verify a snippet's output (SITE.md §2) — but a
  // reader pressing Run on the chance lesson should get different dice, and
  // on the calendar lesson today's date rather than 1962.
  const reply = evaluate({
    source,
    input,
    maxSteps: MAX_STEPS,
    seed: Date.now(),
    now: Date.now(),
  });

  const failed = reply.stoppedAt !== null;
  const text = failed ? reply.diagnostics.map((d) => formatDiagnostic(d)).join('\n') : reply.output;

  out.hidden = false;
  out.classList.toggle('snip-out-bad', failed);
  // No longer the build's verified output, so the page stops claiming it is.
  snippet.classList.add('snip-ran');
  out.innerHTML = `<code>${escapeHtml(
    text.trim() === '' ? (snippet.dataset.empty ?? '') : text,
  )}</code>`;
}

function setUpSnippet(snippet: HTMLElement): void {
  const area = snippet.querySelector('.snip-input');
  const run = snippet.querySelector('.snip-run');
  if (!(area instanceof HTMLTextAreaElement)) return;

  /*
   * The matched bracket pair, kept in step with the caret.
   *
   * Unlike the playground this is not debounced — a lesson's snippet is a few
   * lines, so re-lexing it costs nothing — but it still repaints only when a
   * bracket is beside the caret now or was a moment ago, so arrowing through
   * prose-shaped code does no work.
   */
  /*
   * Nothing is repainted while an input method is composing.
   *
   * `input` fires on every keystroke of a composition, and this code is
   * typed in Ge'ez — so on an Amharic keyboard the overlay was being redrawn
   * underneath a composition in progress, and characters landed away from
   * the caret. The repaint happens once, when the composition finishes.
   */
  let composing = false;
  let wasOnBracket = false;
  const track = (): void => {
    if (composing) return;
    const caret = area.selectionStart;
    const now = besideBracket(area.value, caret);
    if (now || wasOnBracket) repaint(snippet, area.value, caret);
    wasOnBracket = now;
  };

  const afterEdit = (): void => {
    repaint(snippet, area.value, area.selectionStart);
    wasOnBracket = besideBracket(area.value, area.selectionStart);
  };

  area.addEventListener('compositionstart', () => {
    composing = true;
  });

  area.addEventListener('compositionend', () => {
    composing = false;
    afterEdit();
  });

  area.addEventListener('input', () => {
    if (composing) return;
    afterEdit();
  });

  for (const event of ['click', 'keyup', 'select', 'focus'] as const) {
    area.addEventListener(event, track);
  }

  area.addEventListener('blur', () => {
    if (wasOnBracket) repaint(snippet, area.value, null);
    wasOnBracket = false;
  });

  // Keep the two layers aligned when a long line scrolls sideways.
  area.addEventListener('scroll', () => {
    const backdrop = snippet.querySelector('.snip-backdrop');
    if (backdrop instanceof HTMLElement) backdrop.scrollLeft = area.scrollLeft;
  });

  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      runSnippet(snippet, area.value);
    }
  });

  if (run instanceof HTMLButtonElement) {
    run.addEventListener('click', () => {
      runSnippet(snippet, area.value);
    });
  }

  /*
   * The link already carries the original code from the build. Keep it in
   * step as the reader edits, so what opens in the playground is what they
   * are looking at — updated on input rather than on click, because a click
   * handler that rewrites its own href is racing the navigation.
   */
  const open = snippet.querySelector('[data-open-playground]');
  if (open instanceof HTMLAnchorElement) {
    area.addEventListener('input', () => {
      open.href = `/playground/#${encodeProgram(area.value)}`;
    });
  }
}

setUpTheme();
setUpMenu();
setUpContact();
setUpSearch();
for (const snippet of document.querySelectorAll('.snip')) {
  if (snippet instanceof HTMLElement) setUpSnippet(snippet);
}
