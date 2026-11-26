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

import { attachCompletion } from '../shared/completion.js';
import { setUpContact } from '../shared/contact-dialog.js';
import { setUpSearch } from '../shared/search.js';
import { tokenize } from '../../src/lexer/index.js';
import { highlight } from './highlight.js';
import type { Region } from './highlight.js';
import {
  analyse,
  astRowsHtml,
  diagnosticsHtml,
  escapeHtml,
  exampleName,
  gutterHtml,
  inputPrompts,
  needsInput,
  readsRepeatedly,
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
import { setUpMenu } from '../shared/menu.js';
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
const STORAGE_DEBUG = 'ahadu.playground.debug';
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
const askPrompts = need<HTMLOListElement>('ask-prompts');
const askRepeat = need<HTMLParagraphElement>('ask-repeat');
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

/**
 * The token and tree panels are for whoever is working on Ahadu, not for
 * learners: they show the lexer's and the parser's output, which is
 * invaluable when debugging the language and noise when learning it.
 *
 * So they are off unless the playground is opened once with `?debug=1`,
 * which is remembered in this browser until `?debug=0`. The query is taken
 * out of the address straight away, so it does not travel with a shared
 * link. Off, the tabs are not shown and their panels are not even built.
 */
const debug = ((): boolean => {
  const asked = new URLSearchParams(window.location.search).get('debug');
  if (asked !== null) {
    try {
      if (asked === '0') localStorage.removeItem(STORAGE_DEBUG);
      else localStorage.setItem(STORAGE_DEBUG, '1');
    } catch {
      // Storage refused: the flag lasts for this page only.
    }
    history.replaceState(history.state, '', window.location.pathname + window.location.hash);
    if (asked !== '0') return true;
  }
  try {
    return localStorage.getItem(STORAGE_DEBUG) === '1';
  } catch {
    return false;
  }
})();

for (const tab of tabs) {
  if (tab.dataset.panel === 'tokens' || tab.dataset.panel === 'ast') tab.hidden = !debug;
}

/** The tabs a reader can reach — the debug ones only when debugging. */
const shownTabs = tabs.filter((tab) => !tab.hidden);

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
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
    const key = element.dataset.i18nPlaceholder;
    if (key !== undefined && element instanceof HTMLInputElement) {
      element.placeholder = (s as unknown as Record<string, string>)[key] ?? '';
    }
  }

  // The dialog reads its own messages off `data-` attributes, which the site
  // writes at build time from the page's language. This page has one URL and
  // learns its language at runtime, so it writes them here instead.
  const modal = document.getElementById('contact');
  if (modal !== null) {
    modal.dataset.sending = s.contactSending;
    modal.dataset.sent = s.contactSent;
    modal.dataset.failed = s.contactFailed;
    modal.dataset.needMessage = s.contactNeedMessage;
    modal.dataset.tooLong = s.contactTooLong;
    modal.dataset.badEmail = s.contactBadEmail;
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const key = element.dataset.i18nLabel as keyof Strings | undefined;
    if (key === undefined) continue;
    const value = s[key];
    if (typeof value === 'string') element.setAttribute('aria-label', value);
  }

  languageButton.textContent = s.languageToggle;
  // Its text is in the other language ("English" on an Amharic page), and
  // a screen reader should pronounce it as that language (WCAG 3.1.2).
  languageButton.lang = otherLanguage(language);
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
  if (theme === null) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  // The button is labelled "Dark theme"; this says whether it is on.
  const showing = (document.documentElement.dataset.theme as Theme | undefined) ?? systemTheme();
  themeButton.setAttribute('aria-pressed', String(showing === 'dark'));
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

/*
 * Both painters end the copy with an extra line break. A `<pre>` drops a
 * final newline, so a program ending in one was a line shorter behind the
 * textarea than in it: at the bottom the numbers and the textarea scrolled
 * a line further than the coloured code could, and the two came apart.
 */
function paintEditor(): void {
  backdrop.innerHTML = `${highlight({
    source: editor.value,
    tokens: current.tokens,
    diagnostics: current.diagnostics,
    hovered,
    caret,
  })}\n`;
  syncScroll();
}

/** Colours the editor from a fresh lex, ahead of the debounced analysis. */
function paintNow(): void {
  const { tokens, diagnostics } = tokenize(editor.value);
  backdrop.innerHTML = `${highlight({ source: editor.value, tokens, diagnostics, hovered, caret })}\n`;
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
  if (debug) {
    panels.tokens.innerHTML = tokenRowsHtml(current.tokens, s);
    panels.ast.innerHTML = astRowsHtml(current.rows, s);
  }
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
  for (const tab of tabs) {
    const on = tab.dataset.panel === name;
    tab.setAttribute('aria-selected', String(on));
    // One tab stop for the whole set, on the selected tab (WAI-ARIA tabs).
    tab.tabIndex = on ? 0 : -1;
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    showPanel((tab.dataset.panel ?? 'output') as keyof typeof panels);
  });

  // Arrows, Home and End move between tabs and open the one reached.
  tab.addEventListener('keydown', (event) => {
    const i = shownTabs.indexOf(tab);
    const n = shownTabs.length;
    const target =
      event.key === 'ArrowRight'
        ? shownTabs[(i + 1) % n]
        : event.key === 'ArrowLeft'
          ? shownTabs[(i - 1 + n) % n]
          : event.key === 'Home'
            ? shownTabs[0]
            : event.key === 'End'
              ? shownTabs[n - 1]
              : undefined;
    if (target === undefined) return;
    event.preventDefault();
    showPanel((target.dataset.panel ?? 'output') as keyof typeof panels);
    target.focus();
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
  // The output panel said "Running…", which stopped being true.
  panels.output.innerHTML = `<span class="empty">${s.statusStopped}</span>`;
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

  // Show what the program is going to ask for. Being asked for three lines
  // of input with no indication of what they are is the whole complaint.
  const prompts = inputPrompts(current.tokens);
  askPrompts.textContent = '';
  for (const prompt of prompts) {
    const item = document.createElement('li');
    if (prompt === null || prompt.trim() === '') {
      item.textContent = s.inputUnlabelled;
      item.className = 'ask-plain';
    } else {
      item.textContent = prompt.trim();
    }
    askPrompts.append(item);
  }
  askPrompts.hidden = prompts.length === 0;

  // A read inside a loop happens more than once, and the dialog is asking
  // for every answer up front — so say how many lines are really wanted.
  askRepeat.hidden = !readsRepeatedly(current.tokens);

  askOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ask.hidden = false;
  askInput.focus();
  askInput.setSelectionRange(askInput.value.length, askInput.value.length);
}

/** Whatever had focus when the input dialog opened, to give it back. */
let askOpener: HTMLElement | null = null;

function closeAsk(): void {
  ask.hidden = true;
  askOpener?.focus();
  askOpener = null;
}

// The dialog is modal (`aria-modal`), so it behaves like one: Escape closes
// it from anywhere inside, and Tab cycles within it rather than wandering
// off into the page behind.
ask.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAsk();
    return;
  }
  if (event.key !== 'Tab') return;
  const stops = [askInput, askCancel, askRun].filter((el) => !el.hidden);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

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
    // The error that stopped a run is under its output; show it, rather than
    // the top of a long scroll that says nothing went wrong.
    if (reply.diagnostics.length > 0) panels.output.scrollTop = panels.output.scrollHeight;

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
    // Otherwise the status line says "Running…" for good — which is what a
    // reader saw when a deploy shipped without the worker's chunk.
    status.textContent = s.unexpected;
    status.dataset.state = 'bad';
    dispose();
  };

  const request: RunRequest = {
    source: editor.value,
    input,
    maxSteps: MAX_STEPS,
    // A changing seed, so `ዘፈቀደ_ቁጥር` is actually random here. The interpreter's
    // default is fixed, which is what the site's build-time checker wants;
    // a guessing game that picks the same number every time is not one.
    seed: Date.now(),
    // Likewise the clock, so `ዛሬ` is actually today here.
    now: Date.now(),
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
  forgetLink();
  // The last program's output and runtime error do not describe this one.
  dispose();
  runtimeError = null;
  panels.output.innerHTML = `<span class="empty">${s.emptyPressRun}</span>`;
  refresh();
  updatePosition();
  editor.focus();
});

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * Drops a shared program's fragment from the address once the program on
 * screen is no longer that one, so a reload shows the reader's own draft.
 * `replaceState`, so it adds no history entry for Back to step through.
 */
function forgetLink(): void {
  if (window.location.hash === '') return;
  history.replaceState(history.state, '', window.location.pathname + window.location.search);
}

/*
 * Nothing re-lexes while an input method is composing.
 *
 * `input` fires on every keystroke of a composition, and this editor is for
 * Ge'ez — so on an Amharic keyboard the gutter, the readout and the painted
 * copy were all being rebuilt underneath a composition in progress. The work
 * happens once, when the composition finishes.
 */
let composing = false;

editor.addEventListener('compositionstart', () => {
  composing = true;
});

editor.addEventListener('compositionend', () => {
  composing = false;
  editor.dispatchEvent(new Event('input'));
});

editor.addEventListener('input', () => {
  if (composing) return;
  remember(STORAGE_SOURCE, editor.value);
  forgetLink();
  // The program has changed, so last run's error no longer describes it.
  runtimeError = null;
  // The gutter, the readout and the colours follow every keystroke; parsing
  // and the panels wait for the debounce. The colours used to wait too, and
  // since the textarea's own text is transparent, the newest characters were
  // invisible for up to 150 ms. Lexing alone is cheap — lesson snippets do it
  // on every keystroke — and it is all the colouring needs.
  gutter.textContent = gutterHtml(editor.value);
  paintNow();
  updatePosition();
  window.clearTimeout(timer);
  timer = window.setTimeout(refresh, DEBOUNCE_MS);
});

for (const event of ['click', 'keyup', 'select', 'focus'] as const) {
  editor.addEventListener(event, updatePosition);
}

// Suggestions under the caret (TOOLING.md §2.2.1). Its keydown listener is a
// capturing one, so while the list is open it takes Tab and Enter ahead of
// the indent and the run below.
attachCompletion(editor, { language: () => language });

editor.addEventListener('scroll', syncScroll);

/**
 * Escape was the last key pressed, so the next Tab leaves the editor.
 *
 * Tab indents (§3.7), which would make the editor a keyboard trap — WCAG
 * 2.1.2, Level A — if it were the whole story. Shift+Tab always moves focus
 * back, and Escape then Tab moves it forward, the convention code editors on
 * the web share. The editor's description says so to a screen reader.
 */
let tabLeaves = false;

editor.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    tabLeaves = true;
    return;
  }

  if (event.key === 'Tab') {
    if (event.shiftKey || tabLeaves || event.ctrlKey || event.metaKey || event.altKey) {
      tabLeaves = false;
      return;
    }
    event.preventDefault();
    // Through the browser's editing command, so Ctrl+Z takes back an indent
    // like any other typing, and so it goes down the ordinary `input` path:
    // the draft is saved, the shared link forgotten, the analysis re-run.
    if (!document.execCommand('insertText', false, '    ')) {
      editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end');
      editor.dispatchEvent(new Event('input'));
    }
    return;
  }
  tabLeaves = false;

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
 * The fragment stays in the address bar until the program changes — until
 * then the URL is a permalink to what is on screen. The first edit, or
 * picking an example, removes it (`forgetLink`): otherwise a reload, or a
 * phone discarding a background tab, would bring back the original snippet
 * over the reader's work, and their next keystroke would overwrite the
 * draft it had hidden.
 */
const shared = decodeProgram(window.location.hash);
editor.value = shared ?? recall(STORAGE_SOURCE) ?? STARTER;

// A different program pasted into the address bar of an open tab is a
// same-document navigation, which reloads nothing. Load it all the same.
window.addEventListener('hashchange', () => {
  const next = decodeProgram(window.location.hash);
  if (next === null || next === editor.value) return;
  editor.value = next;
  remember(STORAGE_SOURCE, editor.value);
  runtimeError = null;
  refresh();
  updatePosition();
});
askInput.value = recall(STORAGE_INPUT) ?? '';
showPanel('output');
applyLanguage();
// After applyLanguage, which is what gives the hamburger its label.
setUpMenu();
// And the footer's contact button, which is inert until this runs.
setUpContact();
setUpSearch();
panels.output.innerHTML = `<span class="empty">${s.emptyPressRun}</span>`;
