/**
 * What the playground shows, as functions from data to HTML (TOOLING.md §2).
 *
 * None of this touches the DOM. `main.ts` is the glue that puts the strings
 * into elements and wires the events; everything that decides *what* appears
 * lives here, where it can be tested without a browser.
 */

import { tokenize } from '../../src/lexer/index.js';
import type { Token } from '../../src/lexer/index.js';
import { outlineAst, parse } from '../../src/parser/index.js';
import type { AstRow } from '../../src/parser/index.js';
import { codePoints } from '../../src/interpreter/values.js';
import type { Diagnostic } from '../../src/diagnostics.js';
import type { Frame } from '../../src/interpreter/index.js';
import type { RunReply } from './evaluate.js';
import type { Strings } from './strings.js';
import { highlightLine } from './highlight.js';

export interface Analysis {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly Diagnostic[];
  readonly rows: readonly AstRow[];
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Everything short of running the program.
 *
 * The parser is asked even when lexing complained, because its tree is still
 * the best available picture of a half-typed file — which is what the error
 * recovery in LANGUAGE.md §9.3 exists for.
 */
export function analyse(source: string): Analysis {
  const lexed = tokenize(source);
  const parsed = parse(lexed.tokens);
  return {
    tokens: lexed.tokens,
    diagnostics: [...lexed.diagnostics, ...parsed.diagnostics],
    rows: outlineAst(parsed.program),
  };
}

// ---------------------------------------------------------------------------
// Editor furniture
// ---------------------------------------------------------------------------

export interface Position {
  readonly line: number;
  readonly column: number;
}

/**
 * Where a character offset falls, as a line and column.
 *
 * The column counts **code points**, so the readout agrees with the columns
 * in a diagnostic (LANGUAGE.md §2.2). Counting UTF-16 units instead would
 * report a different column for the same place as soon as an astral character
 * is on the line, and the editor would be quietly disagreeing with the errors
 * it displays.
 *
 * The offset arrives from a textarea's `selectionStart`, which *is* a UTF-16
 * index, so the conversion happens here.
 */
export function cursorPosition(source: string, offset: number): Position {
  const upto = source.slice(0, Math.max(0, offset));
  const breaks = upto.split('\n');
  const lastLine = breaks[breaks.length - 1] ?? '';
  return { line: breaks.length, column: codePoints(lastLine).length + 1 };
}

/** The line numbers for a source, one per line, as the gutter shows them. */
export function lineNumbers(source: string): number[] {
  return source.split('\n').map((_, i) => i + 1);
}

export function gutterHtml(source: string): string {
  return lineNumbers(source)
    .map((n) => String(n))
    .join('\n');
}

/** The readout under the editor: a position, or a count when text is selected. */
export function positionLabel(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  s: Strings,
): string {
  const { line, column } = cursorPosition(source, selectionStart);
  const selected = codePoints(source.slice(selectionStart, selectionEnd)).length;
  const position = s.position(line, column);
  return selected === 0 ? position : `${position}  ·  ${s.selection(selected)}`;
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

/** The span attributes a row carries so the editor can highlight its source. */
function spanAttributes(region: {
  line: number;
  startCol: number;
  endLine?: number;
  endCol: number;
}): string {
  const endLine = region.endLine ?? region.line;
  return ` data-line="${region.line}" data-start="${region.startCol}" data-end-line="${endLine}" data-end="${region.endCol}"`;
}

function empty(text: string): string {
  return `<span class="empty">${escapeHtml(text)}</span>`;
}

export function tokenRowsHtml(tokens: readonly Token[], s: Strings): string {
  if (tokens.length === 0) return empty(s.emptyTokens);

  return tokens
    .map((token) => {
      const span = `${token.line}:${token.startCol}-${token.endCol}`.padEnd(12);
      const value =
        token.value === null ? '' : ` <span class="val">${escapeHtml(String(token.value))}</span>`;
      const of =
        token.hasOfPrefix === true
          ? ` <span class="span">(የ + ${escapeHtml(String(token.stem))})</span>`
          : '';
      const attrs = spanAttributes({
        line: token.line,
        startCol: token.startCol,
        endCol: token.endCol,
      });
      return (
        `<span class="row"${attrs}>` +
        `<span class="span">${span}</span>` +
        `<span class="kind">${token.type.padEnd(11)}</span>${value}${of}</span>`
      );
    })
    .join('');
}

export function astRowsHtml(rows: readonly AstRow[], s: Strings): string {
  if (rows.length === 0) return empty(s.emptyAst);

  return rows
    .map((row) => {
      // A group header such as `args:` stands for no node, so it highlights
      // nothing and carries no span.
      const attrs = row.span === null ? '' : spanAttributes(row.span);
      return `<span class="row"${attrs}>${escapeHtml(row.text)}</span>`;
    })
    .join('');
}

/** What a diagnostic needs around it to be rendered. */
export interface DiagnosticView {
  readonly source: string;
  readonly strings: Strings;
  /**
   * The tokens of `source`, used to colour the snippet.
   *
   * Optional: a runtime error arrives with them available, but a caller that
   * has none still gets a readable snippet, just an uncoloured one.
   */
  readonly tokens?: readonly Token[];
}

/** A diagnostic together with the call stack it carried, if it had one. */
export interface Reported {
  readonly diagnostic: Diagnostic;
  readonly frames?: readonly Frame[];
}

/** Wraps plain diagnostics, which carry no traceback. */
export function reported(diagnostics: readonly Diagnostic[]): Reported[] {
  return diagnostics.map((diagnostic) => ({ diagnostic }));
}

/**
 * The offending line, as a snippet with its own gutter.
 *
 * Coloured by the editor's own highlighter, from the same tokens, so a snippet
 * cannot disagree with the code it was taken from — and the diagnostic's span
 * is underlined in place, which needs no caret row to line up.
 */
function snippetHtml(view: DiagnosticView, d: Diagnostic): string {
  const raw = view.source.split('\n')[d.line - 1] ?? '';
  const code =
    view.tokens === undefined
      ? escapeHtml(raw)
      : highlightLine(view.source, view.tokens, d.line, d);

  return (
    `<div class="snippet">` +
    `<span class="snippet-gutter" aria-hidden="true">${d.line}</span>` +
    `<code class="snippet-code">${code === '' ? ' ' : code}</code>` +
    `</div>`
  );
}

function framesHtml(frames: readonly Frame[], s: Strings): string {
  if (frames.length <= 1) return '';
  const rows = frames
    .map(
      (frame, depth) =>
        `<span class="frame" style="padding-left:${depth}rem">` +
        `${depth === 0 ? '' : '↓ '}${escapeHtml(s.traceAt(frame.line, frame.name))}</span>`,
    )
    .join('');
  return `<div class="frames">${rows}</div>`;
}

/**
 * One diagnostic, as a card.
 *
 * Each is a bordered block with the error colour down its left edge, so a
 * panel holding several reads as several things rather than as one wall of
 * text (TOOLING.md §2.1).
 *
 * The message itself is the interpreter's own Amharic and is not translated —
 * it is part of the language (LANGUAGE.md §9), not of this page. The code and
 * the position line around it are ours.
 */
export function diagnosticHtml(view: DiagnosticView, entry: Reported): string {
  const { diagnostic: d, frames = [] } = entry;
  const s = view.strings;

  return (
    `<div class="diag"${spanAttributes(d)}>` +
    `<div class="diag-head">` +
    `<span class="code">${d.code}</span>` +
    `<span class="diag-message">${escapeHtml(d.message)}</span>` +
    `</div>` +
    `<div class="diag-where">${escapeHtml(s.at(d.line, d.startCol))}</div>` +
    snippetHtml(view, d) +
    framesHtml(frames, s) +
    `</div>`
  );
}

/**
 * The errors panel.
 *
 * Takes a list so a runtime error can sit *after* the lexer's and the
 * parser's findings, carrying its own traceback, rather than replacing them.
 * Replacing them is what made a file with five problems look like it had one.
 */
export function diagnosticsHtml(view: DiagnosticView, entries: readonly Reported[]): string {
  if (entries.length === 0) return empty(view.strings.emptyErrors);
  return entries.map((entry) => diagnosticHtml(view, entry)).join('');
}

/** The output panel after a run: what was printed, then the value or the error. */
export function outputHtml(reply: RunReply, s: Strings): string {
  const parts: string[] = [];

  if (reply.output !== '') parts.push(escapeHtml(reply.output.replace(/\n$/, '')));

  const first = reply.diagnostics[0];
  if (first !== undefined) {
    // The one that stopped the run, and a count of the rest, so nobody has to
    // guess whether the ስተቶች panel is holding more.
    const rest = reply.diagnostics.length - 1;
    const more = rest > 0 ? ` ${s.andMore(rest)}` : '';
    parts.push(
      `<span class="value">[${first.code}] ${escapeHtml(first.message)}${escapeHtml(more)}</span>`,
    );
  } else if (reply.value !== null) {
    parts.push(
      `<span class="value">${escapeHtml(s.valuePrefix)} ${escapeHtml(reply.value)}</span>`,
    );
  }

  return parts.length === 0 ? empty(s.emptyOutput) : parts.join('\n');
}

export interface Status {
  readonly text: string;
  readonly state: 'good' | 'bad';
}

export function statusOf(diagnostics: readonly Diagnostic[], s: Strings): Status {
  if (diagnostics.length === 0) return { text: s.statusClean, state: 'good' };
  return { text: s.statusErrors(diagnostics.length), state: 'bad' };
}

/** The example name shown in the menu, from its path. */
export function exampleName(path: string): string {
  return (
    path
      .split('/')
      .pop()
      ?.replace(/\.ahadu$/, '') ?? path
  );
}
