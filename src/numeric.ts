/**
 * Reading a number out of text (LANGUAGE.md §8).
 *
 * The lexer already decides what a number literal looks like. `ወደቁጥር` has to
 * answer the same question about text that arrives at runtime — from `አንብብ`,
 * nearly always — and the two answers must agree, or the language would accept
 * `፫፻፳፩` written in a file and reject the same digits typed at a prompt.
 *
 * So this module holds the one rule, and both sides use it: a number is what
 * the language could have written as a literal, optionally signed, with
 * surrounding whitespace ignored. Nothing else — not `1e3`, not `0x10`, not
 * `١٢٣` — because none of those are Ahadu literals either.
 *
 * It lives above `src/lexer/` rather than inside it because reading a Ge'ez
 * numeral is arithmetic, not lexing; the lexer is simply the other caller.
 */

import { isDigit, isGeezNumeral } from './lexer/constants.js';
import { readGeezNumeral } from './lexer/geez.js';

/**
 * Whitespace `ወደቁጥር` ignores at either end.
 *
 * Someone typing at a prompt adds a space without meaning anything by it, and
 * refusing `" 7 "` would teach them nothing except to distrust the prompt.
 * Ethiopic word space (U+1361, `፡`) is not whitespace: it is punctuation, and
 * `"7፡"` is not a number.
 */
const TRIM = /^[\s ]+|[\s ]+$/gu;

/** Reads an unsigned run of ASCII digits with at most one interior dot (§3.4). */
function readDecimal(text: string): number | null {
  const parts = text.split('.');
  if (parts.length > 2) return null;

  // `5.`, `.5` and `5..5` are not literals: a dot needs digits on both sides.
  for (const part of parts) {
    if (part.length === 0) return null;
    for (const ch of part) if (!isDigit(ch)) return null;
  }

  return Number(text);
}

/** Reads an unsigned run of Ge'ez numeral symbols (§3.4.1). */
function readGeez(text: string): number | null {
  const symbols = [...text];
  for (const sym of symbols) if (!isGeezNumeral(sym)) return null;
  return readGeezNumeral(symbols);
}

/**
 * Reads text as a number, or returns null when it is not one.
 *
 * Null rather than a thrown error, because both callers want to decide for
 * themselves what "not a number" means: `ወደቁጥር` raises `AH3019` and
 * `ቁጥርነው` answers `ሃሰት`.
 */
export function parseNumericText(text: string): number | null {
  const trimmed = text.replace(TRIM, '');
  if (trimmed.length === 0) return null;

  const negative = trimmed.startsWith('-');
  const digits = negative ? trimmed.slice(1) : trimmed;
  if (digits.length === 0) return null;

  const magnitude = isGeezNumeral(digits[0] as string) ? readGeez(digits) : readDecimal(digits);
  if (magnitude === null || !Number.isFinite(magnitude)) return null;

  // `-0` is 0: the language has one zero, and `ወደቁጥር("-0") == 0` must hold.
  return negative ? -magnitude || 0 : magnitude;
}
