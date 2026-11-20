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
 */

import { tokenize } from '../../../src/lexer/index.js';
import { highlight } from '../../playground/highlight.js';
import { evaluate } from '../../playground/evaluate.js';
import { escapeHtml } from '../../playground/view.js';
import { formatDiagnostic } from '../../../src/diagnostics.js';

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
function repaint(snippet: HTMLElement, source: string): void {
  const backdrop = snippet.querySelector('.snip-backdrop code');
  if (!(backdrop instanceof HTMLElement)) return;
  const { tokens, diagnostics } = tokenize(source);
  backdrop.innerHTML = highlight({ source, tokens, diagnostics });
}

function runSnippet(snippet: HTMLElement, source: string): void {
  const out = snippet.querySelector('.snip-out');
  if (!(out instanceof HTMLElement)) return;

  const input = (snippet.dataset.input ?? '').split('\n').filter((line) => line !== '');
  const reply = evaluate({ source, input, maxSteps: MAX_STEPS });

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

  const grow = (): void => {
    // The textarea is the height of its content: a snippet has no scrollbar,
    // because a reader should see the whole program they are reading about.
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };

  area.addEventListener('input', () => {
    repaint(snippet, area.value);
    grow();
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

  // Carry the code to the full playground rather than linking to it bare.
  const open = snippet.querySelector('[data-open-playground]');
  if (open instanceof HTMLAnchorElement) {
    open.addEventListener('click', () => {
      open.href = `/playground/#${encode(area.value)}`;
    });
  }

  grow();
}

/** Base64url of the UTF-8 bytes, so any Ge'ez program survives a URL. */
function encode(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

setUpTheme();
for (const snippet of document.querySelectorAll('.snip')) {
  if (snippet instanceof HTMLElement) setUpSnippet(snippet);
}
