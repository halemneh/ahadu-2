/**
 * The playground's page (TOOLING.md §2).
 *
 * This file is glue: it finds elements, wires events, and puts the strings
 * `view.ts` produces into the page. Everything that decides *what* appears
 * lives in `view.ts`, `highlight.ts` and `strings.ts`, where it is tested
 * without a browser.
 *
 * Lexing and parsing run on every keystroke, debounced, so the editor can
 * colour itself and underline diagnostics while a program is still being
 * typed. Evaluation is the exception: it runs only on አሂድ, in a worker,
 * because the evaluator is synchronous and an endless loop would freeze the
 * tab.
 */

import { highlight } from './highlight.js';
import type { Region } from './highlight.js';
import {
  analyse,
  astRowsHtml,
  diagnosticsHtml,
  escapeHtml,
  exampleName,
  gutterHtml,
  needsInput,
  outputHtml,
  positionLabel,
  reported,
  statusOf,
  tokenRowsHtml,
} from './view.js';
import type { Analysis, Reported } from './view.js';
import { diagnosticAt, positionAt } from './locate.js';
import type { EditorMetrics } from './locate.js';
import { otherLanguage, strings } from './strings.js';
import { decodeProgram } from '../shared/share.js';
import { STORAGE, sectionUrl } from '../shared/nav.js';
import type { Section } from '../shared/nav.js';
import type { Language, Strings } from './strings.js';
import type { RunReply, RunRequest } from './evaluate.js';

/** How long after a keystroke the editor re-lexes (TOOLING.md §2.2). */
const DEBOUNCE_MS = 150;

/** Step budget for a run, beyond which `AH3018` stops the program. */
const MAX_STEPS = 5_000_000;

const STORAGE_SOURCE = 'ahadu.playground.source';
const STORAGE_INPUT = 'ahadu.playground.input';
/*
 * The theme and the language are the site's, not the playground's: arriving
 * here from a lesson should not change either. The site's pages write the
 * language they are being read in, which is how this page — the one URL that
 * serves both — knows which to open in.
 */
const STORAGE_LANGUAGE = STORAGE.language;
const STORAGE_THEME = STORAGE.theme;

type Theme = 'dark' | 'light';

const STARTER = `# አሃዱ 2.0 — ኮድ ጻፉ፣ ከዚያ "አሂድ" ይጫኑ
ዕድሜ = 20

ዕድሜ > 18 ከሆነ፦
    ጻፍ("ትልቅ ሰው")
አለበለዚያ፦
    ጻፍ("ልጅ")

ቆጣሪ = 0
ቆጣሪ < 3 እስከሆነ ድረስ፦
    ጻፍ("ቆጣሪ፦"፣ ቆጣሪ)
    ቆጣሪ = ቆጣሪ + 1
`;

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

function need<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`missing element: ${id}`);
  return element as T;
}

const editor = need<HTMLTextAreaElement>('editor');
const gutter = need<HTMLPreElement>('gutter');
const backdrop = need<HTMLPreElement>('backdrop');
const editorStatus = need<HTMLElement>('editor-status');
const tip = need<HTMLElement>('tip');
const brand = need<HTMLAnchorElement>('brand');
const ask = need<HTMLElement>('ask');
const askInput = need<HTMLTextAreaElement>('ask-input');
const askRun = need<HTMLButtonElement>('ask-run');
const askCancel = need<HTMLButtonElement>('ask-cancel');
const runButton = need<HTMLButtonElement>('run');
const stopButton = need<HTMLButtonElement>('stop');
const examplesSelect = need<HTMLSelectElement>('examples');
const languageButton = need<HTMLButtonElement>('language');
const themeButton = need<HTMLButtonElement>('theme');
const status = need<HTMLOutputElement>('status');
const errorCount = need<HTMLSpanElement>('error-count');

const panels = {
  output: need<HTMLElement>('panel-output'),
  tokens: need<HTMLElement>('panel-tokens'),
  ast: need<HTMLElement>('panel-ast'),
  errors: need<HTMLElement>('panel-errors'),
};

const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab')];

let current: Analysis = { tokens: [], diagnostics: [], rows: [] };
/**
 * The source `current` was produced from.
 *
 * Lexing is debounced, so between a keystroke and the debounce the tokens
 * describe the program as it was. Anything that wants to repaint off-cycle —
 * the caret's bracket match — checks this first, rather than painting the old
 * token spans over the new text.
 */
let analysedSource = '';
/**
 * The runtime error from the last run, if any.
 *
 * Kept apart from the live analysis so it can be shown *after* it rather than
 * instead of it. Cleared when the source changes, since an error from a
 * program that no longer exists is worse than none.
 */
let runtimeError: Reported | null = null;
let hovered: Region | null = null;
/** Where the caret is, so the bracket beside it can light up its partner. */
let caret: number | null = null;
/** Whether the caret had a bracket on either side of it a moment ago. */
let caretWasOnBracket = false;
let worker: Worker | null = null;
/** The pending re-analysis, so a run can cancel it and do the work itself. */
let timer: number | undefined;
let language: Language = 'am';
let s: Strings = strings(language);

// ---------------------------------------------------------------------------
// Storage, which is a convenience and so tolerates being refused
// ---------------------------------------------------------------------------

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked site data both land here; nothing to do.
  }
}

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Language and theme
// ---------------------------------------------------------------------------

/** Fills every element carrying a data-i18n hook from the catalogue. */
function applyLanguage(): void {
  s = strings(language);
  document.documentElement.lang = language;

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n as keyof Strings | undefined;
    if (key === undefined) continue;
    const value = s[key];
    if (typeof value === 'string') element.textContent = value;
  }

  // A few elements want the text as a label rather than as content.
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const key = element.dataset.i18nLabel as keyof Strings | undefined;
    if (key === undefined) continue;
    const value = s[key];
    if (typeof value === 'string') element.setAttribute('aria-label', value);
  }

  languageButton.textContent = s.languageToggle;
  languageButton.setAttribute('aria-label', s.languageToggle);
  themeButton.setAttribute('aria-label', s.theme);
  themeButton.title = s.theme;

  // The header's links are the site's, and the site's URLs are per language.
  for (const link of document.querySelectorAll('[data-section]')) {
    const section = (link as HTMLElement).dataset.section;
    if (link instanceof HTMLAnchorElement && section !== undefined) {
      link.href = sectionUrl(language, section as Section);
    }
  }
  brand.href = sectionUrl(language, 'home');

  fillExamples();
  refresh();
  updatePosition();
}

function setLanguage(next: Language): void {
  language = next;
  remember(STORAGE_LANGUAGE, next);
  applyLanguage();
}

/** The theme in force: an explicit choice, or whatever the system asks for. */
function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme | null): void {
  if (theme === null) {
    delete document.documentElement.dataset.theme;
    return;
  }
  document.documentElement.dataset.theme = theme;
}

function toggleTheme(): void {
  const showing = (document.documentElement.dataset.theme as Theme | undefined) ?? systemTheme();
  const next: Theme = showing === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  remember(STORAGE_THEME, next);
}

languageButton.addEventListener('click', () => {
  setLanguage(otherLanguage(language));
});

themeButton.addEventListener('click', toggleTheme);

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

function paintEditor(): void {
  backdrop.innerHTML = highlight({
    source: editor.value,
    tokens: current.tokens,
    diagnostics: current.diagnostics,
    hovered,
    caret,
  });
  syncScroll();
}

function syncScroll(): void {
  backdrop.scrollTop = editor.scrollTop;
  backdrop.scrollLeft = editor.scrollLeft;
  gutter.scrollTop = editor.scrollTop;
}

/* ---- bracket matching under the caret ---- */

const BRACKET_CHARS = '()[]';

function besideBracket(value: string, at: number): boolean {
  return BRACKET_CHARS.includes(value[at - 1] ?? '') || BRACKET_CHARS.includes(value[at] ?? '');
}

/**
 * Keeps the matched pair in step with the caret.
 *
 * Repainting the backdrop is an `innerHTML` write over the whole program, so
 * it does not happen on every arrow key: only when a bracket is beside the
 * caret now, or was a moment ago — which are exactly the moves that can
 * change which pair is lit. Moving around inside a long body repaints
 * nothing.
 *
 * It also waits for the debounce. Painting mid-keystroke would lay the
 * previous program's token spans over the current text, which is worse than
 * a match that arrives 150 ms late.
 */
function trackCaret(): void {
  caret = editor.selectionStart;
  const now = besideBracket(editor.value, caret);
  if ((now || caretWasOnBracket) && editor.value === analysedSource) paintEditor();
  caretWasOnBracket = now;
}

function updatePosition(): void {
  editorStatus.textContent = positionLabel(
    editor.value,
    editor.selectionStart,
    editor.selectionEnd,
    s,
  );
  trackCaret();
}

/**
 * Paints the errors panel from the live analysis plus any runtime error.
 *
 * Everything the lexer and the parser found, in source order, and then the
 * runtime error after them with its traceback — never one in place of the
 * others.
 */
function paintErrors(): void {
  const entries = reported(current.diagnostics);
  if (runtimeError !== null) entries.push(runtimeError);

  panels.errors.innerHTML = diagnosticsHtml(
    { source: editor.value, strings: s, tokens: current.tokens },
    entries,
  );
  errorCount.textContent = entries.length === 0 ? '' : String(entries.length);
}

function refresh(): void {
  current = analyse(editor.value);
  analysedSource = editor.value;

  gutter.textContent = gutterHtml(editor.value);
  paintEditor();
  panels.tokens.innerHTML = tokenRowsHtml(current.tokens, s);
  panels.ast.innerHTML = astRowsHtml(current.rows, s);
  paintErrors();

  const { text, state } = statusOf(current.diagnostics, s);
  status.textContent = text;
  status.dataset.state = state;
}

// ---------------------------------------------------------------------------
// Hover in the editor: the error under the pointer explains itself (§2.2)
// ---------------------------------------------------------------------------

/**
 * Measures text in the editor's font.
 *
 * A canvas rather than a hidden element, so measuring costs no layout. The
 * font is read from the editor itself, so a change to styles.css cannot put
 * the measurement out of step with what is drawn.
 */
const measure = ((): ((text: string) => number) => {
  const context = document.createElement('canvas').getContext('2d');
  let font = '';

  return (text: string): number => {
    if (context === null) return 0;
    const computed = getComputedStyle(editor);
    const wanted = `${computed.fontSize} ${computed.fontFamily}`;
    if (wanted !== font) {
      context.font = wanted;
      font = wanted;
    }
    return context.measureText(text).width;
  };
})();

function editorMetrics(): EditorMetrics {
  const computed = getComputedStyle(editor);
  return {
    lineHeight: Number.parseFloat(computed.lineHeight),
    paddingTop: Number.parseFloat(computed.paddingTop),
    paddingLeft: Number.parseFloat(computed.paddingLeft),
    scrollTop: editor.scrollTop,
    scrollLeft: editor.scrollLeft,
  };
}

function hideTip(): void {
  tip.hidden = true;
}

/**
 * Shows the error under the pointer, if there is one.
 *
 * The editor is a textarea with its text painted behind it, so there is no
 * element to hover — the position is worked out arithmetically (locate.ts).
 */
function showTipAt(event: MouseEvent): void {
  if (current.diagnostics.length === 0) {
    hideTip();
    return;
  }

  const box = editor.getBoundingClientRect();
  const at = positionAt(
    editor.value,
    event.clientX - box.left,
    event.clientY - box.top,
    editorMetrics(),
    measure,
  );

  const found = diagnosticAt(current.diagnostics, at);
  if (found === null) {
    hideTip();
    return;
  }

  tip.innerHTML =
    `<span class="code">${found.code}</span>${escapeHtml(found.message)}` +
    `<br /><span class="where">${escapeHtml(s.at(found.line, found.startCol))}</span>`;
  tip.hidden = false;

  // Below the pointer by default, above it when there is no room.
  const size = tip.getBoundingClientRect();
  const left = Math.min(event.clientX + 12, window.innerWidth - size.width - 8);
  const below = event.clientY + 18;
  const top = below + size.height > window.innerHeight ? event.clientY - size.height - 12 : below;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

editor.addEventListener('mousemove', showTipAt);
editor.addEventListener('mouseleave', hideTip);
editor.addEventListener('scroll', hideTip);
editor.addEventListener('blur', hideTip);

// There is no caret when the editor does not have focus, so the matched pair
// goes out with it rather than being left lit over code nobody is editing.
editor.addEventListener('blur', () => {
  caret = null;
  if (caretWasOnBracket) paintEditor();
  caretWasOnBracket = false;
});

// ---------------------------------------------------------------------------
// Hover in a panel: a row lights up the source it covers (§2.1)
// ---------------------------------------------------------------------------

function regionOf(element: HTMLElement): Region | null {
  const line = Number(element.dataset.line);
  if (!Number.isFinite(line) || line === 0) return null;
  return {
    line,
    startCol: Number(element.dataset.start ?? '1'),
    endLine: Number(element.dataset.endLine ?? element.dataset.line),
    endCol: Number(element.dataset.end ?? element.dataset.start ?? '1'),
  };
}

for (const panel of [panels.tokens, panels.ast, panels.errors]) {
  panel.addEventListener('pointerover', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.row, .diag');
    hovered = row === null ? null : regionOf(row);
    paintEditor();
  });

  panel.addEventListener('pointerleave', () => {
    if (hovered === null) return;
    hovered = null;
    paintEditor();
  });
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function showPanel(name: keyof typeof panels): void {
  for (const [key, element] of Object.entries(panels)) element.hidden = key !== name;
  for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.panel === name));
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    showPanel((tab.dataset.panel ?? 'output') as keyof typeof panels);
  });
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

function setRunning(running: boolean): void {
  runButton.hidden = running;
  stopButton.hidden = !running;
}

function dispose(): void {
  worker?.terminate();
  worker = null;
  setRunning(false);
}

function stop(): void {
  dispose();
  status.textContent = s.statusStopped;
  status.dataset.state = 'bad';
}

/**
 * Asks for input, then runs — or runs straight away.
 *
 * The dialog opens *before* the program starts rather than when `አንብብ` is
 * reached, because a synchronous call inside a worker cannot wait for one
 * (view.ts explains the constraint).
 */
function start(): void {
  // Re-analyse rather than just repaint, in case the run came within the
  // debounce of a keystroke and the live analysis is a moment behind.
  window.clearTimeout(timer);
  runtimeError = null;
  refresh();

  if (!needsInput(current.tokens)) {
    launch(inputLines());
    return;
  }

  ask.hidden = false;
  askInput.focus();
  askInput.setSelectionRange(askInput.value.length, askInput.value.length);
}

function closeAsk(): void {
  ask.hidden = true;
}

function inputLines(): string[] {
  return askInput.value === '' ? [] : askInput.value.split('\n');
}

askCancel.addEventListener('click', closeAsk);

askRun.addEventListener('click', () => {
  remember(STORAGE_INPUT, askInput.value);
  closeAsk();
  launch(inputLines());
});

askInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAsk();
  // Enter adds a line; the modifier runs, as in the editor.
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    askRun.click();
  }
});

ask.addEventListener('click', (event) => {
  if (event.target === ask) closeAsk();
});

function launch(input: readonly string[]): void {
  dispose();

  showPanel('output');
  panels.output.innerHTML = `<span class="empty">${s.emptyRunning}</span>`;
  status.textContent = s.statusRunning;
  setRunning(true);

  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (event: MessageEvent<RunReply>): void => {
    const reply = event.data;
    panels.output.innerHTML = outputHtml(reply, s);

    const first = reply.diagnostics[0];
    if (first === undefined) {
      status.textContent = s.statusDone;
      status.dataset.state = 'good';
    } else {
      // Only a runtime error is news: anything the lexer or the parser found
      // is already in the live analysis, and adding it again would double it.
      runtimeError =
        reply.stoppedAt === 'runtime' ? { diagnostic: first, frames: reply.frames } : null;
      status.textContent = first.code;
      status.dataset.state = 'bad';
    }

    paintErrors();
    dispose();
  };

  worker.onerror = (): void => {
    panels.output.innerHTML = `<span class="empty">${s.unexpected}</span>`;
    dispose();
  };

  const request: RunRequest = {
    source: editor.value,
    input,
    maxSteps: MAX_STEPS,
    // A changing seed, so `አጋጣሚ` is actually random here. The interpreter's
    // default is fixed, which is what the site's build-time checker wants;
    // a guessing game that picks the same number every time is not one.
    seed: Date.now(),
  };
  worker.postMessage(request);
}

runButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);

// ---------------------------------------------------------------------------
// Examples, loaded from the repository so they are the same programs the
// conformance suite runs (§2.2)
// ---------------------------------------------------------------------------

const programs = import.meta.glob<string>('../../examples/*.ahadu', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Programs that are meant to fail, kept in their own directory.
 *
 * They cannot live beside the others: `tests/conformance/run.test.ts` asserts
 * that everything in `examples/` runs clean, which is exactly what these do
 * not do.
 */
const broken = import.meta.glob<string>('../../examples/errors/*.ahadu', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function fillExamples(): void {
  const chosen = examplesSelect.value;
  examplesSelect.replaceChildren();
  examplesSelect.append(new Option(s.examplesNone, ''));

  for (const [label, group] of [
    [s.examplesPrograms, programs],
    [s.examplesErrors, broken],
  ] as const) {
    const paths = Object.keys(group).sort();
    if (paths.length === 0) continue;

    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    for (const path of paths) optgroup.append(new Option(exampleName(path), path));
    examplesSelect.append(optgroup);
  }

  examplesSelect.value = chosen;
}

examplesSelect.addEventListener('change', () => {
  const source = programs[examplesSelect.value] ?? broken[examplesSelect.value];
  if (source === undefined) return;
  editor.value = source;
  remember(STORAGE_SOURCE, editor.value);
  refresh();
  updatePosition();
  editor.focus();
});

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

editor.addEventListener('input', () => {
  remember(STORAGE_SOURCE, editor.value);
  // The program has changed, so last run's error no longer describes it.
  runtimeError = null;
  // The gutter and the readout follow every keystroke; the colours wait for
  // the debounce, since re-lexing is the expensive half.
  gutter.textContent = gutterHtml(editor.value);
  updatePosition();
  window.clearTimeout(timer);
  timer = window.setTimeout(refresh, DEBOUNCE_MS);
});

for (const event of ['click', 'keyup', 'select', 'focus'] as const) {
  editor.addEventListener(event, updatePosition);
}

editor.addEventListener('scroll', syncScroll);

editor.addEventListener('keydown', (event) => {
  // Tab inserts one indent level rather than leaving the editor (§3.7).
  if (event.key === 'Tab') {
    event.preventDefault();
    const { selectionStart: from, selectionEnd: to, value } = editor;
    editor.value = `${value.slice(0, from)}    ${value.slice(to)}`;
    editor.selectionStart = from + 4;
    editor.selectionEnd = from + 4;
    remember(STORAGE_SOURCE, editor.value);
    refresh();
    updatePosition();
    return;
  }

  // Ctrl/Cmd+Enter runs, the way a notebook cell does.
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    start();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const savedTheme = recall(STORAGE_THEME);
applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : null);

const savedLanguage = recall(STORAGE_LANGUAGE);
language = savedLanguage === 'en' ? 'en' : 'am';

/*
 * A program may arrive in the URL fragment, which is how a lesson's "open in
 * playground" link hands over the snippet the reader was looking at
 * (tools/shared/share.ts). It wins over the saved draft, because someone who
 * followed a link meant to see that program.
 *
 * The fragment is left in the address bar rather than cleaned away: it makes
 * the URL a permalink to this program, which is worth more than saving a
 * reader from re-reading the link they just followed. Edits still go to
 * storage, so leaving and coming back without the link keeps them.
 */
const shared = decodeProgram(window.location.hash);
editor.value = shared ?? recall(STORAGE_SOURCE) ?? STARTER;
askInput.value = recall(STORAGE_INPUT) ?? '';
showPanel('output');
applyLanguage();
panels.output.innerHTML = `<span class="empty">${s.emptyPressRun}</span>`;
