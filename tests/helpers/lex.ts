/** Shared helpers for lexer tests. */

import { describeToken, tokenize } from '../../src/lexer/index.js';
import type { Token } from '../../src/lexer/index.js';

/** Tokens with the trailing EOF dropped, which most tests do not care about. */
export function lex(source: string): Token[] {
  const { tokens } = tokenize(source);
  return tokens.slice(0, -1);
}

/** Every token including EOF. */
export function lexAll(source: string): Token[] {
  return [...tokenize(source).tokens];
}

/** Diagnostic codes in source order. */
export function codes(source: string): string[] {
  return tokenize(source).diagnostics.map((d) => d.code);
}

/** `TYPE:value@line:startCol-endCol` for each token, EOF dropped. */
export function shape(source: string): string[] {
  return lex(source).map(describeToken);
}

/** Token types only, EOF dropped. */
export function types(source: string): string[] {
  return lex(source).map((t) => t.type);
}

/** Token values only, EOF dropped. */
export function values(source: string): (string | number | null)[] {
  return lex(source).map((t) => t.value);
}
