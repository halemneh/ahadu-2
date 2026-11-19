/**
 * The playground's page (TOOLING.md §2).
 *
 * This file is glue: it finds elements, wires events, and puts the strings
 * `view.ts` produces into the page. Everything that decides *what* appears
 * lives in `view.ts` and `highlight.ts`, where it is tested without a browser.
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
  diagnosticHtml,
  diagnosticsHtml,
  exampleName,
  outputHtml,
  statusOf,
  tokenRowsHtml,
} from './view.js';
import type { Analysis } from './view.js';
import type { RunReply, RunRequest } from './worker.js';

/** How long after a keystroke the editor re-lexes (TOOLING.md §2.2). */
const DEBOUNCE_MS = 150;

/** Step budget for a run, beyond which `AH3018` stops the program. */
const MAX_STEPS = 5_000_000;

const STORAGE_SOURCE = 'ahadu.playground.source';
const STORAGE_INPUT = 'ahadu.playground.input';

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
const backdrop = need<HTMLPreElement>('backdrop');
const inputBox = need<HTMLTextAreaElement>('stdin');
const runButton = need<HTMLButtonElement>('run');
const stopButton = need<HTMLButtonElement>('stop');
const examplesSelect = need<HTMLSelectElement>('examples');
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
let hovered: Region | null = null;
let worker: Worker | null = null;

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
// Painting
// ---------------------------------------------------------------------------

function paintEditor(): void {
  backdrop.innerHTML = highlight({
    source: editor.value,
    tokens: current.tokens,
    diagnostics: current.diagnostics,
    hovered,
  });
  backdrop.scrollTop = editor.scrollTop;
  backdrop.scrollLeft = editor.scrollLeft;
}

function refresh(): void {
  current = analyse(editor.value);

  paintEditor();
  panels.tokens.innerHTML = tokenRowsHtml(current.tokens);
  panels.ast.innerHTML = astRowsHtml(current.rows);
  panels.errors.innerHTML = diagnosticsHtml(editor.value, current.diagnostics);

  errorCount.textContent =
    current.diagnostics.length === 0 ? '' : String(current.diagnostics.length);

  const { text, state } = statusOf(current.diagnostics);
  status.textContent = text;
  status.dataset.state = state;
}

// ---------------------------------------------------------------------------
// Hover: a panel row lights up the source it covers (§2.1)
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
  status.textContent = 'ተቋርጧል';
  status.dataset.state = 'bad';
}

function start(): void {
  dispose();

  showPanel('output');
  panels.output.innerHTML = '<span class="empty">ይሰራል…</span>';
  setRunning(true);

  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (event: MessageEvent<RunReply>): void => {
    const reply = event.data;
    panels.output.innerHTML = outputHtml(reply);

    if (reply.diagnostic === null) {
      status.textContent = 'ተጠናቋል';
      status.dataset.state = 'good';
    } else {
      panels.errors.innerHTML = diagnosticHtml(editor.value, reply.diagnostic, reply.frames);
      errorCount.textContent = '1';
      status.textContent = reply.diagnostic.code;
      status.dataset.state = 'bad';
    }

    dispose();
  };

  worker.onerror = (): void => {
    panels.output.innerHTML = '<span class="empty">ያልተጠበቀ ስተት።</span>';
    dispose();
  };

  const request: RunRequest = {
    source: editor.value,
    input: inputBox.value === '' ? [] : inputBox.value.split('\n'),
    maxSteps: MAX_STEPS,
  };
  worker.postMessage(request);
}

runButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);

// ---------------------------------------------------------------------------
// Examples, loaded from the repository so they are the same programs the
// conformance suite runs (§2.2)
// ---------------------------------------------------------------------------

const examples = import.meta.glob<string>('../../examples/*.ahadu', {
  query: '?raw',
  import: 'default',
  eager: true,
});

examplesSelect.append(new Option('—', ''));
for (const path of Object.keys(examples).sort()) {
  examplesSelect.append(new Option(exampleName(path), path));
}

examplesSelect.addEventListener('change', () => {
  const source = examples[examplesSelect.value];
  if (source === undefined) return;
  editor.value = source;
  remember(STORAGE_SOURCE, editor.value);
  refresh();
  editor.focus();
});

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

let timer: number | undefined;

editor.addEventListener('input', () => {
  remember(STORAGE_SOURCE, editor.value);
  window.clearTimeout(timer);
  timer = window.setTimeout(refresh, DEBOUNCE_MS);
});

editor.addEventListener('scroll', () => {
  backdrop.scrollTop = editor.scrollTop;
  backdrop.scrollLeft = editor.scrollLeft;
});

inputBox.addEventListener('input', () => {
  remember(STORAGE_INPUT, inputBox.value);
});

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

editor.value = recall(STORAGE_SOURCE) ?? STARTER;
inputBox.value = recall(STORAGE_INPUT) ?? '';
showPanel('output');
panels.output.innerHTML = '<span class="empty">"አሂድ" ይጫኑ</span>';
refresh();
