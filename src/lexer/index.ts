/**
 * The lexer stage (LANGUAGE.md §2–3).
 *
 * `tokenize` is the whole public surface: it never throws, and returns every
 * problem it found alongside the tokens it managed to produce.
 */

export { tokenize } from './lexer.js';
export type { LexResult } from './lexer.js';
export type { KeywordType, Token, TokenType } from './token.js';
export { RESERVED_SPELLINGS, describeToken, isKeyword } from './token.js';
export {
  KEYWORDS,
  TAB_WIDTH,
  WHILE_TAIL,
  isDigit,
  isGeezNumeral,
  isWordChar,
} from './constants.js';
export { readGeezNumeral } from './geez.js';
