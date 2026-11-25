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
  /**
   * Where the caret is, as `textarea.selectionStart` gives it — a UTF-16
   * offset, which is what the DOM speaks. The bracket beside it and that
   * bracket's partner are marked. `null` when nothing has the caret.
   */
  readonly caret?: number | null;
}

/**
 * CSS class per token kind. Anything absent is left unstyled.
 *
 * The four brackets are missing on purpose: their class is their nesting
 * depth, which is a property of the token *stream* rather than of any one
 * token, so `markBrackets` works them out separately.
 */
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
  /*
   * Ahadu's three Ethiopic marks carry structure that a reader of an
   * English-based language would take from a keyword instead, so each gets
   * its own treatment rather than one shared punctuation colour:
   *
   *   ፦  opens a block. It does the job `:` does in an indented language, and
   *      is painted and weighted like the keyword that leads up to it.
   *   ።  ends a statement.
   *   ፣  separates the items of a list or an argument list.
   *
   * `:` and `.` stay quiet: they are ASCII spellings that already read as
   * punctuation to everyone, and `:` only ever appears inside a slice.
   */
  THEN: 'tk-then',
  STOP: 'tk-stop',
  COMMA: 'tk-sep',
  COLON: 'tk-punct',
  DOT: 'tk-punct',
};

/** Keyword sub-types that name a type, which read better in their own colour. */
const TYPE_KEYWORDS = new Set(['TYPE_NUM', 'TYPE_BOOL', 'TYPE_STRING', 'TYPE_LIST']);

const OPENERS = new Set<TokenType>(['LPAREN', 'LBRACKET']);
const CLOSERS = new Set<TokenType>(['RPAREN', 'RBRACKET']);

/** Which opener each closer answers, so a pair is only ever of one kind. */
const PARTNER: Partial<Record<TokenType, TokenType>> = {
  RPAREN: 'LPAREN',
  RBRACKET: 'LBRACKET',
};

/** How many depths the bracket colours run through before repeating. */
const BRACKET_DEPTHS = 3;

/** One source code point, and what should be true of it on screen. */
interface Cell {
  readonly char: string;
  /** Token class, or '' when nothing claimed this column. */
  cls: string;
  /** Covered by a diagnostic's span. */
  bad: boolean;
  /** Covered by the region the pointer is over in a panel. */
  hot: boolean;
  /** One of the pair of brackets the caret is sitting beside. */
  match: boolean;
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

/**
 * Paints `(`, `)`, `[` and `]` by how deeply they are nested, and marks the
 * pair the caret is sitting beside.
 *
 * Depth is counted over `(` and `[` together rather than per kind, because
 * that is how they actually nest in a program — `ዝ[ድምር(ሀ፣ ለ)]` is three
 * levels deep however the brackets are spelled, and colouring the two kinds
 * on separate counters would give the `(` the same colour as the `[` it sits
 * inside. The lexer counts them on one counter for the same reason (§3.5).
 *
 * A stray closer keeps the outermost colour rather than a negative depth. It
 * is already a parse error with a diagnostic of its own, and `fragment`
 * snippets on the site are allowed to be unbalanced by design.
 */
function markBrackets(grid: Cell[][], tokens: readonly Token[], caret: Caret | null): void {
  const open: Token[] = [];
  /** Every pair that closed, so the caret can be matched against them. */
  const pairs: [Token, Token][] = [];

  const paint = (token: Token, cls: string): void => {
    const cells = grid[token.line - 1];
    if (cells === undefined) return;
    for (let col = token.startCol; col <= token.endCol; col += 1) {
      const cell = cells[col - 1];
      if (cell !== undefined) cell.cls = cls;
    }
  };

  for (const token of tokens) {
    if (OPENERS.has(token.type)) {
      paint(token, `tk-br${open.length % BRACKET_DEPTHS}`);
      open.push(token);
    } else if (CLOSERS.has(token.type)) {
      const opener = open.pop();
      paint(token, `tk-br${(opener === undefined ? 0 : open.length) % BRACKET_DEPTHS}`);
      // Only when the kinds answer each other. `ጻፍ(1]` is a syntax error, and
      // highlighting `(` and `]` as a pair tells the reader it is not — which
      // is worse than saying nothing, because the one thing they need to see
      // is that those two do not go together.
      if (opener !== undefined && PARTNER[token.type] === opener.type) {
        pairs.push([opener, token]);
      }
    }
  }

  if (caret === null) return;

  // Beside, not on: the caret is a gap between characters, so a bracket
  // counts when the gap is on either side of it. An editor that only lit up
  // the bracket to the right would go dark the moment you typed a `)`.
  const beside = (token: Token): boolean =>
    token.line === caret.line && (caret.col === token.startCol || caret.col === token.endCol + 1);

  for (const [opener, closer] of pairs) {
    if (!beside(opener) && !beside(closer)) continue;
    for (const token of [opener, closer]) {
      const cells = grid[token.line - 1];
      const cell = cells?.[token.startCol - 1];
      if (cell !== undefined) cell.match = true;
    }
    return;
  }
}

/** A caret, as a 1-based line and code-point column — what tokens speak. */
interface Caret {
  readonly line: number;
  readonly col: number;
}

/**
 * Turns `textarea.selectionStart` into a line and a code-point column.
 *
 * The DOM counts UTF-16 units and the lexer counts code points
 * (LANGUAGE.md §2.2); for Ge'ez the two agree, but an emoji in a string
 * literal would put every column after it out by one.
 */
function caretAt(source: string, offset: number): Caret {
  let line = 1;
  let col = 1;
  let seen = 0;
  for (const char of source) {
    if (seen >= offset) break;
    seen += char.length;
    if (char === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
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

/** What `build` needs: regions rather than diagnostics, since marks are positional. */
interface Marks {
  readonly source: string;
  readonly tokens: readonly Token[];
  /** Underlined as a problem. A `Diagnostic` already has this shape. */
  readonly bad?: readonly Region[];
  readonly hot?: Region | null;
  readonly caret?: number | null;
}

/** Builds the per-column grid for a source, with every mark applied. */
function build(input: Marks): Cell[][] {
  const grid: Cell[][] = input.source
    .split('\n')
    .map((line) =>
      codePoints(line).map((char) => ({ char, cls: '', bad: false, hot: false, match: false })),
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

  markBrackets(grid, input.tokens, input.caret == null ? null : caretAt(input.source, input.caret));
  markComments(grid);

  for (const region of input.bad ?? []) markRegion(grid, region, 'bad');
  if (input.hot != null) markRegion(grid, input.hot, 'hot');

  return grid;
}

/** Emits one line, coalescing neighbouring columns that share their classes. */
function renderLine(cells: readonly Cell[]): string {
  if (cells.length === 0) return '';

  const parts: string[] = [];
  let run = '';
  let key = '';

  const flush = (): void => {
    if (run === '') return;
    parts.push(key === '' ? escapeHtml(run) : `<span class="${key}">${escapeHtml(run)}</span>`);
    run = '';
  };

  for (const cell of cells) {
    const classes = [
      cell.cls,
      cell.bad ? 'tk-bad' : '',
      cell.hot ? 'tk-hot' : '',
      cell.match ? 'tk-match' : '',
    ]
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
}

/**
 * Renders source as HTML for the editor's backdrop.
 *
 * Every line is emitted, including empty ones, so the backdrop's line count
 * matches the textarea's exactly — otherwise the two drift apart as soon as
 * the program has a blank line in it.
 */
export function highlight(input: HighlightInput): string {
  return build({
    source: input.source,
    tokens: input.tokens,
    bad: input.diagnostics ?? [],
    hot: input.hovered ?? null,
    caret: input.caret ?? null,
  })
    .map(renderLine)
    .join('\n');
}

/**
 * Renders a single line, for the snippet inside a diagnostic.
 *
 * The same colours as the editor, from the same tokens, so a snippet cannot
 * disagree with the code it was taken from. The diagnostic's own span is
 * marked, which underlines the offending characters *in place* — no caret row
 * to align, and so none of the trouble Ethiopic's variable width gives the
 * CLI's `^^^` (TOOLING.md §1).
 */
export function highlightLine(
  source: string,
  tokens: readonly Token[],
  line: number,
  mark?: Region | null,
): string {
  const grid = build({ source, tokens, bad: mark == null ? [] : [mark] });
  const cells = grid[line - 1];
  return cells === undefined ? '' : renderLine(cells);
}
