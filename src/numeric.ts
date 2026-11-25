/**
 * Numbers and their written forms (LANGUAGE.md §8.3, §8.7).
 *
 * The lexer already decides what a number literal looks like. `ወደ_ቁጥር` has to
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
 * Whitespace `ወደ_ቁጥር` ignores at either end.
 *
 * Someone typing at a prompt adds a space without meaning anything by it, and
 * refusing `" 7 "` would teach them nothing except to distrust the prompt.
 * Ethiopic word space (U+1361, `፡`) is not whitespace: it is punctuation, and
 * `"7፡"` is not a number.
 */
const TRIM = /^[\s ]+|[\s ]+$/gu;

/**
 * Strips the whitespace Ahadu ignores from both ends.
 *
 * Exported so `ከርክም` and `ወደ_ቁጥር` agree about what whitespace is. Two
 * definitions would eventually disagree, and then `ወደ_ቁጥር(ከርክም(ግቤት))` would
 * fail on something `ከርክም` claimed to have cleaned.
 */
export function trimText(text: string): string {
  return text.replace(TRIM, '');
}

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
 * themselves what "not a number" means: `ወደ_ቁጥር` raises `AH3019` and
 * `ቁጥር_ነው` answers `ሃሰት`.
 */
export function parseNumericText(text: string): number | null {
  const trimmed = text.replace(TRIM, '');
  if (trimmed.length === 0) return null;

  const negative = trimmed.startsWith('-');
  const digits = negative ? trimmed.slice(1) : trimmed;
  if (digits.length === 0) return null;

  const magnitude = isGeezNumeral(digits[0] as string) ? readGeez(digits) : readDecimal(digits);
  if (magnitude === null || !Number.isFinite(magnitude)) return null;

  // `-0` is 0: the language has one zero, and `ወደ_ቁጥር("-0") == 0` must hold.
  return negative ? -magnitude || 0 : magnitude;
}

// ---------------------------------------------------------------------------
// Writing Ge'ez numerals (§8.7)
// ---------------------------------------------------------------------------

/**
 * The largest number Ge'ez numerals can spell under §3.4.1's grammar.
 *
 * The grammar allows at most one `፼` and, within each of its two parts, at
 * most one `፻`. So a part reaches 99×100 + 99 = 9,999 and the whole reaches
 * 9,999×10,000 + 9,999.
 */
export const MAX_GEEZ = 99_999_999;

const UNIT_SYMBOLS = ['', '፩', '፪', '፫', '፬', '፭', '፮', '፯', '፰', '፱'];
const TEN_SYMBOLS = ['', '፲', '፳', '፴', '፵', '፶', '፷', '፸', '፹', '፺'];

/** A separator-free group, 0–99. Zero is the empty string, having no symbol. */
function writeGroup(value: number): string {
  return `${TEN_SYMBOLS[Math.floor(value / 10)] as string}${UNIT_SYMBOLS[value % 10] as string}`;
}

/**
 * One `፼` part, 0–9999, as `[group] ፻ [group]`.
 *
 * A leading group of exactly 1 is left out, because §3.4.1 reads an empty
 * group before a separator as 1 — so a hundred is `፻`, not `፩፻`. Writing the
 * `፩` would still read back as 100, but it is not how the numerals are
 * written.
 */
function writeHundreds(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds === 0) return writeGroup(rest);
  return `${hundreds === 1 ? '' : writeGroup(hundreds)}፻${writeGroup(rest)}`;
}

/**
 * Writes a number in Ge'ez numerals, or returns null when it has no spelling.
 *
 * Null for anything that is not a whole number from 1 to `MAX_GEEZ`. **Zero
 * has no Ge'ez numeral** — the system is additive, built from symbols that
 * each carry a value, with nothing standing for none — and neither do
 * negatives or fractions. That is a fact about the numerals rather than a
 * limitation of this function, so `ወደ_ግዕዝ` reports it (`AH3021`) instead of
 * inventing a spelling.
 *
 * The inverse of `readGeezNumeral`, and a test round-trips every value in a
 * wide range through both.
 */
export function writeGeezNumeral(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > MAX_GEEZ) return null;

  const myriads = Math.floor(value / 10_000);
  const rest = value % 10_000;
  if (myriads === 0) return writeHundreds(rest);

  // As with `፻`, a leading 1 before `፼` is left out: 10,000 is `፼`.
  const lead = myriads === 1 ? '' : writeHundreds(myriads);
  return `${lead}፼${rest === 0 ? '' : writeHundreds(rest)}`;
}
