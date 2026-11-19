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
import type { Diagnostic } from '../../src/diagnostics.js';
import type { Frame } from '../../src/interpreter/index.js';
import type { RunReply } from './worker.js';

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

export function tokenRowsHtml(tokens: readonly Token[]): string {
  if (tokens.length === 0) return '<span class="empty">ምንም ቶከን የለም</span>';

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

export function astRowsHtml(rows: readonly AstRow[]): string {
  if (rows.length === 0) return '<span class="empty">ምንም ዛፍ የለም</span>';

  return rows
    .map((row) => {
      // A group header such as `args:` stands for no node, so it highlights
      // nothing and carries no span.
      const attrs = row.span === null ? '' : spanAttributes(row.span);
      return `<span class="row"${attrs}>${escapeHtml(row.text)}</span>`;
    })
    .join('');
}

/** A diagnostic as the panel shows it: code, message, position, source line, traceback. */
export function diagnosticHtml(
  source: string,
  d: Diagnostic,
  frames: readonly Frame[] = [],
): string {
  const line = source.split('\n')[d.line - 1] ?? '';
  const stack =
    frames.length <= 1
      ? ''
      : `<div class="frames">${frames
          .map(
            (frame, depth) =>
              `${'  '.repeat(depth)}${depth === 0 ? '' : '↓ '}መስመር ${frame.line} ላይ ${escapeHtml(frame.name)}`,
          )
          .join('\n')}</div>`;

  return (
    `<div class="diag"${spanAttributes(d)}>` +
    `<span class="code">[${d.code}]</span> ${escapeHtml(d.message)}\n` +
    `<span class="where">መስመር ${d.line} ላይ: ${d.startCol}ኛው ካራክተር</span>\n\n` +
    `    ${d.line}: ${escapeHtml(line)}\n${stack}</div>`
  );
}

export function diagnosticsHtml(source: string, diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return '<span class="empty">ምንም ስተት አልተገኘም።</span>';
  return diagnostics.map((d) => diagnosticHtml(source, d)).join('');
}

/** The output panel after a run: what was printed, then the value or the error. */
export function outputHtml(reply: RunReply): string {
  const parts: string[] = [];

  if (reply.output !== '') parts.push(escapeHtml(reply.output.replace(/\n$/, '')));

  if (reply.diagnostic !== null) {
    parts.push(
      `<span class="value">[${reply.diagnostic.code}] ${escapeHtml(reply.diagnostic.message)}</span>`,
    );
  } else if (reply.value !== null) {
    parts.push(`<span class="value">ዋጋ፦ ${escapeHtml(reply.value)}</span>`);
  }

  return parts.length === 0 ? '<span class="empty">ምንም ውጤት የለም</span>' : parts.join('\n');
}

export interface Status {
  readonly text: string;
  readonly state: 'good' | 'bad';
}

export function statusOf(diagnostics: readonly Diagnostic[]): Status {
  if (diagnostics.length === 0) return { text: 'ምንም ስተት የለም', state: 'good' };
  return { text: `${diagnostics.length} ስተት`, state: 'bad' };
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
