/**
 * Lexical tables (LANGUAGE.md §3).
 *
 * Every Amharic spelling here is normative and comes from the spec's keyword
 * table (§3.2). `tests/unit/lexer/spec-tables.test.ts` re-parses that table
 * out of `spec/LANGUAGE.md` and fails if this file drifts from it — several
 * variants differ only by a visually similar syllable (`ሀ`/`ሃ`/`ኀ`), so the
 * comparison is done by machine rather than by eye.
 */

import type { KeywordType } from './token.js';

// ---------------------------------------------------------------------------
// Keywords (§3.2)
// ---------------------------------------------------------------------------

/**
 * Whole-word spellings → keyword sub-type. Spelling variants collapse here,
 * and this is the only folding in the language: identifiers are compared by
 * exact code points (§3.1).
 */
export const KEYWORDS: Readonly<Record<string, KeywordType>> = {
  // if — 3 variants
  ከሆነ: 'IF',
  ከሖነ: 'IF',
  ከኆነ: 'IF',

  // else-if lead-in
  ግን: 'ELIF',

  // else — 4 variants
  አለበለዚያ: 'ELSE',
  ኣለበለዚያ: 'ELSE',
  ዓለበለዚያ: 'ELSE',
  ዐለበለዚያ: 'ELSE',

  // while head — 6 variants; the required ` ድረስ` tail is handled in the lexer
  እስከሆነ: 'WHILE',
  እስከሖነ: 'WHILE',
  እስከኆነ: 'WHILE',
  ዕስከሆነ: 'WHILE',
  ዕስከሖነ: 'WHILE',
  ዕስከኆነ: 'WHILE',

  ተመላሽ: 'RETURN',
  ተግባር: 'FUNC',
  ክላስ: 'CLASS',
  ፍጠር: 'INIT',

  // and — 2 variants (the `&` / `&&` aliases are operators, not words)
  እና: 'AND',
  ዕና: 'AND',

  ወይም: 'OR',
  ተቃርኖ: 'NOT',

  // true — 2 variants
  እውነት: 'TRUE',
  ዕውነት: 'TRUE',

  // false — 12 variants
  ሃሰት: 'FALSE',
  ሀሰት: 'FALSE',
  ኅሰት: 'FALSE',
  ኃሰት: 'FALSE',
  ሓሰት: 'FALSE',
  ሐሰት: 'FALSE',
  ሃሠት: 'FALSE',
  ሀሠት: 'FALSE',
  ኅሠት: 'FALSE',
  ኃሠት: 'FALSE',
  ሓሠት: 'FALSE',
  ሐሠት: 'FALSE',

  ምንም: 'NOTHING',

  // type annotations
  ቁጥር: 'TYPE_NUM',
  እውነታ: 'TYPE_BOOL',
  ጽሁፍ: 'TYPE_STRING',
  ፅሁፍ: 'TYPE_STRING',
  ስብስብ: 'TYPE_LIST',

  // reserved — recognized, but no syntax in 2.0 (parser reports AH2010)
  አዲስ: 'RESERVED_NEW',
  ለእያንዳንዱ: 'RESERVED_FOR',
  አቁም: 'RESERVED_BREAK',
  ቀጥል: 'RESERVED_CONTINUE',
  ፊደል: 'RESERVED_CHAR',
};

/** The required second word of `እስከሆነ ድረስ` (§3.8). */
export const WHILE_TAIL = 'ድረስ';

// ---------------------------------------------------------------------------
// Strings (§3.6)
// ---------------------------------------------------------------------------

/**
 * Recognized escape sequences. Any other escaped character denotes itself, so
 * `\q` is `q` and `\\`, `\"`, `\'` fall out of that rule without entries.
 */
export const ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
};

// ---------------------------------------------------------------------------
// Indentation (§3.7)
// ---------------------------------------------------------------------------

/** One indent level: 4 spaces, or one tab counted as 4 columns. */
export const TAB_WIDTH = 4;

// ---------------------------------------------------------------------------
// Code points with special meaning
// ---------------------------------------------------------------------------

export const BOM = '\uFEFF';
export const OF_PREFIX = 'የ'; // U+12E8

/**
 * Format-control code points skipped everywhere, including inside
 * identifiers, without consuming a column (§2.1). Ge'ez text pasted from word
 * processors and the web routinely carries these.
 */
export const IGNORED_FORMAT_CHARS: ReadonlySet<string> = new Set([
  '\u200B', // zero-width space
  '\u200C', // zero-width non-joiner
  '\u200D', // zero-width joiner
  '\u00AD', // soft hyphen
]);

// ---------------------------------------------------------------------------
// Ge'ez numerals (§3.4.1)
// ---------------------------------------------------------------------------

/** Units ፩–፱ → 1–9. */
export const GEEZ_UNITS: Readonly<Record<string, number>> = {
  '፩': 1,
  '፪': 2,
  '፫': 3,
  '፬': 4,
  '፭': 5,
  '፮': 6,
  '፯': 7,
  '፰': 8,
  '፱': 9,
};

/** Tens ፲–፺ → 10–90. */
export const GEEZ_TENS: Readonly<Record<string, number>> = {
  '፲': 10,
  '፳': 20,
  '፴': 30,
  '፵': 40,
  '፶': 50,
  '፷': 60,
  '፸': 70,
  '፹': 80,
  '፺': 90,
};

export const GEEZ_HUNDRED = '፻'; // ×100
export const GEEZ_MYRIAD = '፼'; // ×10000

// ---------------------------------------------------------------------------
// Character classification (§3.1, §3.4)
// ---------------------------------------------------------------------------

/**
 * A word character: Ethiopic syllables and the supplement/extended blocks,
 * ASCII letters and digits, and `_`.
 *
 * Deliberately excluded: Ethiopic punctuation (U+1360–U+1368), which is
 * punctuation, and Ethiopic digits and numerals (U+1369–U+137C), which are
 * number literals — so `፩` is the number 1 and never part of a name.
 */
export function isWordChar(ch: string): boolean {
  const c = ch.codePointAt(0) ?? -1;
  return (
    (c >= 0x1200 && c <= 0x135a) || // Ethiopic syllables
    (c >= 0x1380 && c <= 0x139f) || // Ethiopic Supplement
    (c >= 0x2d80 && c <= 0x2ddf) || // Ethiopic Extended
    (c >= 0xab01 && c <= 0xab2f) || // Ethiopic Extended-A
    (c >= 0x61 && c <= 0x7a) || // a-z
    (c >= 0x41 && c <= 0x5a) || // A-Z
    (c >= 0x30 && c <= 0x39) || // 0-9
    c === 0x5f // _
  );
}

/** An ASCII digit. */
export function isDigit(ch: string): boolean {
  const c = ch.codePointAt(0) ?? -1;
  return c >= 0x30 && c <= 0x39;
}

/** A Ge'ez numeral symbol (U+1369–U+137C), including the ×100 and ×10000 separators. */
export function isGeezNumeral(ch: string): boolean {
  const c = ch.codePointAt(0) ?? -1;
  return c >= 0x1369 && c <= 0x137c;
}
