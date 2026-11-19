/**
 * Syntax highlighting for the playground's editor (TOOLING.md §2).
 *
 * The colours come from the lexer's own tokens rather than from a parallel set
 * of regular expressions, so what the editor shows is by construction what
 * Ahadu read — a keyword variant the lexer accepts cannot fail to light up,
 * and one it rejects cannot pretend to be a keyword.
 *
 * The result is HTML for a `<pre>` sitting exactly behind a transparent
 * `<textarea>`: same font, same size, same padding. That is what lets a
 * diagnostic underline a span, and a hovered token light up its source,
 * without reimplementing text editing.
 */

import type { Token, TokenType } from '../../src/lexer/index.js';
import { codePoints } from '../../src/interpreter/values.js';
import type { Diagnostic } from '../../src/diagnostics.js';

/** A region of source, as AST spans and diagnostics both describe one. */
export interface Region {
  readonly line: number;
  readonly startCol: number;
  readonly endLine?: number;
  readonly endCol: number;
}

export interface HighlightInput {
  readonly source: string;
  readonly tokens: readonly Token[];
  readonly diagnostics?: readonly Diagnostic[];
  /** Highlighted because the pointer is over its row in a panel. */
  readonly hovered?: Region | null;
}

/** CSS class per token kind. Anything absent is left unstyled. */
const CLASSES: Partial<Record<TokenType, string>> = {
  NUMBER: 'tk-num',
  STRING: 'tk-str',
  KEYWORD: 'tk-kw',
  IDENTIFIER: 'tk-id',
  PLUS: 'tk-op',
  MINUS: 'tk-op',
  STAR: 'tk-op',
  SLASH: 'tk-op',
  PERCENT: 'tk-op',
  CARET: 'tk-op',
  ASSIGN: 'tk-op',
  EQ: 'tk-op',
  NEQ: 'tk-op',
  LT: 'tk-op',
  LTE: 'tk-op',
  GT: 'tk-op',
  GTE: 'tk-op',
  THEN: 'tk-then',
  STOP: 'tk-punct',
  COMMA: 'tk-punct',
  COLON: 'tk-punct',
  DOT: 'tk-punct',
  LPAREN: 'tk-punct',
  RPAREN: 'tk-punct',
  LBRACKET: 'tk-punct',
  RBRACKET: 'tk-punct',
};

/** Keyword sub-types that name a type, which read better in their own colour. */
const TYPE_KEYWORDS = new Set(['TYPE_NUM', 'TYPE_BOOL', 'TYPE_STRING', 'TYPE_LIST']);

/** One source code point, and what should be true of it on screen. */
interface Cell {
  readonly char: string;
  /** Token class, or '' when nothing claimed this column. */
  cls: string;
  /** Covered by a diagnostic's span. */
  bad: boolean;
  /** Covered by the region the pointer is over in a panel. */
  hot: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function classFor(token: Token): string {
  if (token.type === 'KEYWORD' && typeof token.value === 'string') {
    if (TYPE_KEYWORDS.has(token.value)) return 'tk-type';
    if (token.value.startsWith('RESERVED_')) return 'tk-reserved';
    if (token.value === 'TRUE' || token.value === 'FALSE' || token.value === 'NOTHING') {
      return 'tk-lit';
    }
  }
  return CLASSES[token.type] ?? '';
}

/** Marks every column a region covers, across however many lines it spans. */
function markRegion(grid: Cell[][], region: Region, field: 'bad' | 'hot'): void {
  const lastLine = region.endLine ?? region.line;

  for (let line = region.line; line <= lastLine; line += 1) {
    const cells = grid[line - 1];
    if (cells === undefined) continue;

    const from = line === region.line ? region.startCol : 1;
    const to = line === lastLine ? region.endCol : cells.length;

    for (let col = from; col <= to; col += 1) {
      const cell = cells[col - 1];
      if (cell !== undefined) cell[field] = true;
    }
  }
}

/**
 * Finds comments, which produce no tokens at all (§2.3).
 *
 * A `#` is a comment only where no token claimed the column — inside a string
 * the lexer has already covered it, so this cannot mistake `"ሀ # ለ"` for one.
 */
function markComments(grid: Cell[][]): void {
  for (const cells of grid) {
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i] as Cell;
      if (cell.cls !== '') continue;
      if (cell.char !== '#') continue;
      for (let j = i; j < cells.length; j += 1) (cells[j] as Cell).cls = 'tk-comment';
      break;
    }
  }
}

/**
 * Renders source as HTML for the editor's backdrop.
 *
 * Every line is emitted, including empty ones, so the backdrop's line count
 * matches the textarea's exactly — otherwise the two drift apart as soon as
 * the program has a blank line in it.
 */
export function highlight(input: HighlightInput): string {
  const lines = input.source.split('\n');
  const grid: Cell[][] = lines.map((line) =>
    codePoints(line).map((char) => ({ char, cls: '', bad: false, hot: false })),
  );

  for (const token of input.tokens) {
    const cells = grid[token.line - 1];
    if (cells === undefined) continue;
    const cls = classFor(token);
    if (cls === '') continue;
    for (let col = token.startCol; col <= token.endCol; col += 1) {
      const cell = cells[col - 1];
      if (cell !== undefined) cell.cls = cls;
    }
  }

  markComments(grid);

  for (const d of input.diagnostics ?? []) markRegion(grid, d, 'bad');
  if (input.hovered != null) markRegion(grid, input.hovered, 'hot');

  return (
    grid
      .map((cells) => {
        if (cells.length === 0) return '';

        const parts: string[] = [];
        let run = '';
        let key = '';

        const flush = (): void => {
          if (run === '') return;
          parts.push(
            key === '' ? escapeHtml(run) : `<span class="${key}">${escapeHtml(run)}</span>`,
          );
          run = '';
        };

        for (const cell of cells) {
          const classes = [cell.cls, cell.bad ? 'tk-bad' : '', cell.hot ? 'tk-hot' : '']
            .filter((c) => c !== '')
            .join(' ');
          if (classes !== key) {
            flush();
            key = classes;
          }
          run += cell.char;
        }
        flush();

        return parts.join('');
      })
      // A trailing newline keeps the last line scrollable into view, matching
      // how a textarea treats one.
      .join('\n')
  );
}
