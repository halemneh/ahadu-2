/**
 * Tokens (LANGUAGE.md §3).
 *
 * Positions are 1-based and inclusive, and columns count **code points**, so a
 * Ge'ez syllable is one column (§2.2).
 */

export type TokenType =
  // Literals and names
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  | 'KEYWORD'
  // Arithmetic
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'CARET'
  // Assignment and comparison
  | 'ASSIGN'
  | 'EQ'
  | 'NEQ'
  | 'LT'
  | 'LTE'
  | 'GT'
  | 'GTE'
  // Grouping
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  // Punctuation
  | 'COMMA'
  | 'COLON'
  | 'DOT'
  | 'THEN'
  | 'STOP'
  // Structure
  | 'INDENT'
  | 'NEWLINE'
  | 'EOF';

/**
 * The sub-type carried in a KEYWORD token's `value` (§3.2).
 *
 * `RESERVED_*` words lex as keywords but have no syntax in 2.0; the parser
 * reports `AH2010` when one is used.
 */
export type KeywordType =
  | 'IF'
  | 'ELIF'
  | 'ELSE'
  | 'WHILE'
  | 'FOREACH'
  | 'RETURN'
  | 'FUNC'
  | 'CLASS'
  | 'INIT'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'TRUE'
  | 'FALSE'
  | 'NOTHING'
  | 'TYPE_NUM'
  | 'TYPE_BOOL'
  | 'TYPE_STRING'
  | 'TYPE_LIST'
  | 'RESERVED_NEW'
  | 'RESERVED_BREAK'
  | 'RESERVED_CONTINUE'
  | 'RESERVED_CHAR';

export interface Token {
  readonly type: TokenType;
  /**
   * NUMBER: the numeric value. STRING: the decoded contents. IDENTIFIER: the
   * name. KEYWORD: the `KeywordType`. Everything else: null.
   */
  readonly value: string | number | null;
  readonly line: number;
  readonly startCol: number;
  readonly endCol: number;
  /** IDENTIFIER only: the name began with the possessive `የ` (§3.3). */
  readonly hasOfPrefix?: true;
  /** IDENTIFIER with `hasOfPrefix`: the name with `የ` removed. */
  readonly stem?: string;
}

/** The canonical Amharic spelling of each reserved word, for error messages. */
export const RESERVED_SPELLINGS: Readonly<Record<string, string>> = {
  RESERVED_NEW: 'አዲስ',
  RESERVED_BREAK: 'አቁም',
  RESERVED_CONTINUE: 'ቀጥል',
  RESERVED_CHAR: 'ፊደል',
};

export function isKeyword(token: Token, sub: KeywordType): boolean {
  return token.type === 'KEYWORD' && token.value === sub;
}

/** A compact `TYPE:value@line:startCol-endCol` form, for test output and `ahadu tokens`. */
export function describeToken(t: Token): string {
  const span = `${t.line}:${t.startCol}-${t.endCol}`;
  return t.value === null ? `${t.type}@${span}` : `${t.type}:${String(t.value)}@${span}`;
}
