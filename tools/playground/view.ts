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
import type { RunReply } from './worker.js';
import type { Strings } from './strings.js';

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

/**
 * A diagnostic as the panel shows it.
 *
 * The message is the interpreter's own Amharic and is not translated — it is
 * part of the language (LANGUAGE.md §9), not of this page. The position line
 * around it is ours, so it follows the chosen language.
 */
export function diagnosticHtml(
  source: string,
  d: Diagnostic,
  s: Strings,
  frames: readonly Frame[] = [],
): string {
  const line = source.split('\n')[d.line - 1] ?? '';
  const stack =
    frames.length <= 1
      ? ''
      : `<div class="frames">${frames
          .map(
            (frame, depth) =>
              `${'  '.repeat(depth)}${depth === 0 ? '' : '↓ '}${escapeHtml(
                s.traceAt(frame.line, frame.name),
              )}`,
          )
          .join('\n')}</div>`;

  return (
    `<div class="diag"${spanAttributes(d)}>` +
    `<span class="code">[${d.code}]</span> ${escapeHtml(d.message)}\n` +
    `<span class="where">${escapeHtml(s.at(d.line, d.startCol))}</span>\n\n` +
    `    ${d.line}: ${escapeHtml(line)}\n${stack}</div>`
  );
}

export function diagnosticsHtml(
  source: string,
  diagnostics: readonly Diagnostic[],
  s: Strings,
): string {
  if (diagnostics.length === 0) return empty(s.emptyErrors);
  return diagnostics.map((d) => diagnosticHtml(source, d, s)).join('');
}

/** The output panel after a run: what was printed, then the value or the error. */
export function outputHtml(reply: RunReply, s: Strings): string {
  const parts: string[] = [];

  if (reply.output !== '') parts.push(escapeHtml(reply.output.replace(/\n$/, '')));

  if (reply.diagnostic !== null) {
    parts.push(
      `<span class="value">[${reply.diagnostic.code}] ${escapeHtml(reply.diagnostic.message)}</span>`,
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
