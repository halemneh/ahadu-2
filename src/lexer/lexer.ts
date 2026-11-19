/**
 * The lexer: source text → tokens (LANGUAGE.md §2–3, §9.3).
 *
 * Two invariants hold throughout:
 *
 * 1. **It never throws and never stops early.** Every problem becomes a
 *    diagnostic and scanning continues, because an editor has to keep
 *    highlighting a half-typed file (§3.9).
 * 2. **Columns count code points.** The source is decomposed into a code-point
 *    array once, up front, so a Ge'ez syllable is one column and column
 *    arithmetic is exact (§2.2).
 */

import type { Diagnostic } from '../diagnostics.js';
import {
  AH1001,
  AH1002,
  AH1003,
  AH1004,
  AH1005,
  diagnostic,
  sortDiagnostics,
} from '../diagnostics.js';
import type { KeywordType, Token, TokenType } from './token.js';
import {
  BOM,
  ESCAPES,
  IGNORED_FORMAT_CHARS,
  KEYWORDS,
  OF_PREFIX,
  TAB_WIDTH,
  WHILE_TAIL,
  isDigit,
  isGeezNumeral,
  isWordChar,
} from './constants.js';
import { readGeezNumeral } from './geez.js';

export interface LexResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly Diagnostic[];
}

/** Leading-whitespace character with the column it occupied and its width in columns. */
interface SpaceRun {
  readonly col: number;
  readonly width: number;
}

class Lexer {
  /** The source as code points, so indices and columns agree (§2.2). */
  private readonly chars: readonly string[];
  private i = 0;
  private line = 1;
  private col = 1;
  private readonly tokens: Token[] = [];
  private readonly diagnostics: Diagnostic[] = [];
  /**
   * Depth of unclosed `(` and `[`. Inside brackets a logical line continues,
   * so leading whitespace carries no meaning and produces neither INDENT
   * tokens nor indentation errors (§3.7, §5.1).
   */
  private brackets = 0;
  private atLineStart = true;

  constructor(source: string) {
    this.chars = Array.from(source);
  }

  // -------------------------------------------------------------------------
  // Cursor
  // -------------------------------------------------------------------------

  private get done(): boolean {
    return this.i >= this.chars.length;
  }

  private peek(ahead = 0): string | null {
    return this.chars[this.i + ahead] ?? null;
  }

  /** Consumes one code point and advances the column. */
  private take(): string {
    const ch = this.chars[this.i] as string;
    this.i += 1;
    this.col += 1;
    return ch;
  }

  /** Consumes one code point *without* advancing the column (§2.1). */
  private skipInvisible(): void {
    this.i += 1;
  }

  private newLine(): void {
    this.line += 1;
    this.col = 1;
    this.atLineStart = true;
  }

  // -------------------------------------------------------------------------
  // Emitting
  // -------------------------------------------------------------------------

  private emit(
    type: TokenType,
    value: string | number | null,
    line: number,
    startCol: number,
    endCol: number,
  ): void {
    this.tokens.push({ type, value, line, startCol, endCol });
  }

  private report(code: string, line: number, startCol: number, endCol: number): void {
    this.diagnostics.push(diagnostic(code, 'lexer', line, startCol, endCol));
  }

  // -------------------------------------------------------------------------
  // Entry point
  // -------------------------------------------------------------------------

  run(): LexResult {
    // A byte-order mark at the very start is skipped and occupies no column
    // (§2.1). Anywhere else it falls through to AH1001 like any stray code point.
    if (this.peek() === BOM) this.skipInvisible();

    while (!this.done) {
      if (this.atLineStart) {
        this.atLineStart = false;
        this.scanIndentation();
        continue;
      }
      this.scanToken();
    }

    this.emit('EOF', null, this.line, this.col, this.col);
    return { tokens: this.tokens, diagnostics: sortDiagnostics(this.diagnostics) };
  }

  // -------------------------------------------------------------------------
  // Indentation (§3.7)
  // -------------------------------------------------------------------------

  private scanIndentation(): void {
    const line = this.line;
    const runs: SpaceRun[] = [];

    while (this.peek() === ' ' || this.peek() === '\t') {
      const col = this.col;
      const ch = this.take();
      runs.push({ col, width: ch === '\t' ? TAB_WIDTH : 1 });
    }

    // A line holding only whitespace — with or without a comment — is blank:
    // no INDENT tokens and no indentation error (§3.7).
    const next = this.peek();
    const blank = next === null || next === '\n' || next === '\r' || next === '#';
    if (blank || this.brackets > 0 || runs.length === 0) return;

    const total = runs.reduce((sum, r) => sum + r.width, 0);
    const levels = Math.floor(total / TAB_WIDTH);

    for (let level = 0; level < levels; level += 1) {
      const span = this.spanOf(runs, level * TAB_WIDTH + 1, (level + 1) * TAB_WIDTH);
      this.emit('INDENT', null, line, span[0], span[1]);
    }

    const leftover = total % TAB_WIDTH;
    if (leftover > 0) {
      const span = this.spanOf(runs, levels * TAB_WIDTH + 1, total);
      this.report(AH1002, line, span[0], span[1]);
    }
  }

  /**
   * Maps a range of normalized columns back to the source columns that
   * produced it. A tab contributes four normalized columns from one source
   * column, so an indent level can span fewer source columns than four — and
   * a tab that straddles a level boundary is named by both.
   */
  private spanOf(runs: readonly SpaceRun[], fromWidth: number, toWidth: number): [number, number] {
    let seen = 0;
    let first: number | null = null;
    let last = runs[0]?.col ?? this.col;

    for (const run of runs) {
      const start = seen + 1;
      const end = seen + run.width;
      seen = end;
      if (end < fromWidth || start > toWidth) continue;
      if (first === null) first = run.col;
      last = run.col;
    }

    return [first ?? last, last];
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  private scanToken(): void {
    const ch = this.peek() as string;
    const line = this.line;
    const col = this.col;

    // Invisible formatting is skipped in code, but kept inside string
    // literals, which are data (§2.1).
    if (IGNORED_FORMAT_CHARS.has(ch)) {
      this.skipInvisible();
      return;
    }

    switch (ch) {
      case '#':
        this.skipComment();
        return;
      case '\n':
        this.take();
        this.emit('NEWLINE', null, line, col, col);
        this.newLine();
        return;
      case '\r':
        this.take();
        if (this.peek() === '\n') this.take();
        this.emit('NEWLINE', null, line, col, col);
        this.newLine();
        return;
      case ' ':
      case '\t':
        // Mid-line whitespace only separates tokens (§3.7).
        this.take();
        return;
      case '"':
      case "'":
        this.scanString();
        return;
      case '=':
        this.take();
        if (this.peek() === '=') {
          this.take();
          this.emit('EQ', null, line, col, col + 1);
        } else {
          this.emit('ASSIGN', null, line, col, col);
        }
        return;
      case '!':
        this.take();
        if (this.peek() === '=') {
          this.take();
          this.emit('NEQ', null, line, col, col + 1);
        } else {
          // Bare `!` is an alias for ተቃርኖ (§3.5).
          this.emit('KEYWORD', 'NOT' satisfies KeywordType, line, col, col);
        }
        return;
      case '<':
      case '‹': // ‹
        this.scanRelational('LT', 'LTE', line, col);
        return;
      case '>':
      case '›': // ›
        this.scanRelational('GT', 'GTE', line, col);
        return;
      case '&':
        this.scanWordOperator('AND', line, col);
        return;
      case '|':
        this.scanWordOperator('OR', line, col);
        return;
      case '+':
        this.single('PLUS', line, col);
        return;
      case '-':
        this.single('MINUS', line, col);
        return;
      case '*':
        this.single('STAR', line, col);
        return;
      case '/':
        this.single('SLASH', line, col);
        return;
      case '%':
        this.single('PERCENT', line, col);
        return;
      case '^':
        this.single('CARET', line, col);
        return;
      case '(':
        this.brackets += 1;
        this.single('LPAREN', line, col);
        return;
      case ')':
        this.brackets = Math.max(0, this.brackets - 1);
        this.single('RPAREN', line, col);
        return;
      case '[':
        this.brackets += 1;
        this.single('LBRACKET', line, col);
        return;
      case ']':
        this.brackets = Math.max(0, this.brackets - 1);
        this.single('RBRACKET', line, col);
        return;
      case ',':
      case '፣': // ፣
        this.single('COMMA', line, col);
        return;
      case '.':
        this.single('DOT', line, col);
        return;
      case ':':
      case '፡': // ፡
        this.take();
        // `:-` opens a block — but only outside brackets. A block cannot open
        // inside an unclosed `(` or `[`, while a slice with a negative end
        // can: `ዝ[:-1]` has to read as COLON then MINUS, not as THEN (§3.5).
        if (this.peek() === '-' && this.brackets === 0) {
          this.take();
          this.emit('THEN', null, line, col, col + 1);
        } else {
          this.emit('COLON', null, line, col, col);
        }
        return;
      case '፦': // ፦
        this.single('THEN', line, col);
        return;
      case '።': // ።
        this.single('STOP', line, col);
        return;
      default:
        break;
    }

    if (isDigit(ch)) {
      this.scanNumber();
      return;
    }
    if (isGeezNumeral(ch)) {
      this.scanGeezNumber();
      return;
    }
    if (isWordChar(ch)) {
      this.scanWord();
      return;
    }

    // Unrecognized code point: report once, skip, keep going (§3.9).
    this.take();
    this.report(AH1001, line, col, col);
  }

  private single(type: TokenType, line: number, col: number): void {
    this.take();
    this.emit(type, null, line, col, col);
  }

  private scanRelational(bare: TokenType, withEq: TokenType, line: number, col: number): void {
    this.take();
    if (this.peek() === '=') {
      this.take();
      this.emit(withEq, null, line, col, col + 1);
    } else {
      this.emit(bare, null, line, col, col);
    }
  }

  /**
   * `&`, `&&`, `|`, `||` produce the same tokens as `እና` and `ወይም`, so
   * precedence and parsing need not know which spelling was used (§3.5).
   */
  private scanWordOperator(sub: KeywordType, line: number, col: number): void {
    const ch = this.take();
    let endCol = col;
    if (this.peek() === ch) {
      this.take();
      endCol = col + 1;
    }
    this.emit('KEYWORD', sub, line, col, endCol);
  }

  private skipComment(): void {
    // Terminates on end of input as well as on a line break — the omission of
    // that check is what hung v1-py on a trailing comment (CHANGES C22).
    while (!this.done && this.peek() !== '\n' && this.peek() !== '\r') this.take();
  }

  // -------------------------------------------------------------------------
  // Numbers (§3.4)
  // -------------------------------------------------------------------------

  private scanNumber(): void {
    const line = this.line;
    const startCol = this.col;
    let text = '';

    while (!this.done && isDigit(this.peek() as string)) text += this.take();

    // A `.` is part of the number only with digits on both sides, so `5.` is
    // `5` then DOT and `1.2.3` is `1.2`, DOT, `3` (§3.4).
    const after = this.peek(1);
    if (this.peek() === '.' && after !== null && isDigit(after)) {
      text += this.take();
      while (!this.done && isDigit(this.peek() as string)) text += this.take();
    }

    this.emit('NUMBER', Number(text), line, startCol, this.col - 1);
  }

  private scanGeezNumber(): void {
    const line = this.line;
    const startCol = this.col;
    const symbols: string[] = [];

    while (!this.done && isGeezNumeral(this.peek() as string)) symbols.push(this.take());

    const endCol = this.col - 1;
    const value = readGeezNumeral(symbols);

    if (value === null) {
      // Emit a placeholder so the parser can carry on structurally; the
      // diagnostic is what stops the program from running.
      this.report(AH1005, line, startCol, endCol);
      this.emit('NUMBER', 0, line, startCol, endCol);
      return;
    }

    this.emit('NUMBER', value, line, startCol, endCol);
  }

  // -------------------------------------------------------------------------
  // Strings (§3.6)
  // -------------------------------------------------------------------------

  private scanString(): void {
    const line = this.line;
    const startCol = this.col;
    const quote = this.take();
    let out = '';
    let escaped = false;
    // Where an unterminated string's span ends: the last code point consumed.
    let lastCol = startCol;

    while (!this.done) {
      const ch = this.peek() as string;
      if (ch === '\n' || ch === '\r') break; // a raw line break never appears in a string

      const col = this.col;
      this.take();
      lastCol = col;

      if (escaped) {
        // A recognized escape, or else the character itself — which is what
        // makes `\\`, `\"` and `\'` work without their own entries (§3.6).
        out += ESCAPES[ch] ?? ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        this.emit('STRING', out, line, startCol, col);
        return;
      }
      out += ch;
    }

    // Unterminated, at a line break or at end of input. The token still
    // carries what was scanned so an editor can keep highlighting, and the
    // span runs from the opening delimiter to the last code point consumed
    // (§3.6, CHANGES C40).
    this.emit('STRING', out, line, startCol, lastCol);
    this.report(AH1003, line, startCol, lastCol);
  }

  // -------------------------------------------------------------------------
  // Words: identifiers and keywords (§3.1–3.3, §3.8)
  // -------------------------------------------------------------------------

  private scanWord(): void {
    const line = this.line;
    const startCol = this.col;
    let word = '';
    let endCol = startCol;

    while (!this.done) {
      const ch = this.peek() as string;
      if (isWordChar(ch)) {
        endCol = this.col;
        word += this.take();
        continue;
      }
      // Invisible formatting inside a name is dropped and costs no column, so
      // `ሰ​ላም` is the identifier `ሰላም` (§2.1).
      if (IGNORED_FORMAT_CHARS.has(ch)) {
        this.skipInvisible();
        continue;
      }
      break;
    }

    // A name beginning with የ keeps the prefix attached; the parser decides
    // whether it is possessive (§3.3, CHANGES C23).
    if (word.startsWith(OF_PREFIX)) {
      const stem = word.slice(OF_PREFIX.length);
      if (stem.length === 0) {
        this.report(AH1001, line, startCol, endCol);
        return;
      }
      this.tokens.push({
        type: 'IDENTIFIER',
        value: word,
        line,
        startCol,
        endCol,
        hasOfPrefix: true,
        stem,
      });
      return;
    }

    const keyword = KEYWORDS[word];
    if (keyword === undefined) {
      this.emit('IDENTIFIER', word, line, startCol, endCol);
      return;
    }
    if (keyword === 'WHILE') {
      this.scanWhileTail(line, startCol, endCol);
      return;
    }
    this.emit('KEYWORD', keyword, line, startCol, endCol);
  }

  /**
   * `እስከሆነ` is one half of a two-word keyword. Exactly one space and then
   * `ድረስ` must follow, and the resulting WHILE token spans both words
   * including the space (§3.8).
   *
   * `እስከሆነ` alone is `AH1004` — not an identifier, and not a silent loop head
   * either, which is how the two predecessors disagreed (CHANGES C11). The
   * token is still emitted so the parser sees the structure.
   */
  private scanWhileTail(line: number, startCol: number, headEndCol: number): void {
    const tail = Array.from(WHILE_TAIL);
    let matches = this.peek() === ' ';
    for (let n = 0; matches && n < tail.length; n += 1) {
      if (this.peek(n + 1) !== tail[n]) matches = false;
    }
    // Whole-word: `እስከሆነ ድረስነገር` is not the tail.
    const after = this.peek(tail.length + 1);
    if (matches && after !== null && isWordChar(after)) matches = false;

    if (!matches) {
      this.report(AH1004, line, startCol, headEndCol);
      this.emit('KEYWORD', 'WHILE', line, startCol, headEndCol);
      return;
    }

    let endCol = headEndCol;
    for (let n = 0; n < tail.length + 1; n += 1) {
      endCol = this.col;
      this.take();
    }
    this.emit('KEYWORD', 'WHILE', line, startCol, endCol);
  }
}

/**
 * Tokenizes Ahadu source.
 *
 * Accepts a string, or raw UTF-8 bytes — malformed sequences decode to U+FFFD
 * and are then reported as illegal characters rather than aborting the scan
 * (§2.1).
 *
 * Never throws: every problem comes back in `diagnostics`, sorted into source
 * order (§3.9).
 */
export function tokenize(input: string | Uint8Array): LexResult {
  const source =
    typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: false }).decode(input);
  return new Lexer(source).run();
}
