/**
 * Ge'ez numeral literals (LANGUAGE.md §3.4.1).
 *
 * The system is additive-multiplicative rather than positional: `፫፻፳፩` is
 * 3×100 + 20 + 1 = 321. A run is read by splitting on the two separators —
 * `፼` (×10000), then `፻` (×100) — and reading what is left as at most one
 * tens symbol followed by at most one units symbol.
 *
 * An empty group before a separator counts as 1, so `፻` alone is 100 and `፼`
 * alone is 10000. An empty group after a separator counts as 0.
 */

import { GEEZ_HUNDRED, GEEZ_MYRIAD, GEEZ_TENS, GEEZ_UNITS } from './constants.js';

/**
 * Splits a run on a separator.
 *
 * Splitting rather than searching is what makes "at most one of these" a
 * structural property: two separators yield three parts, which the callers
 * reject outright, and every part handed downstream is free of that
 * separator. By the time a run reaches `readGroup`, it can only hold units
 * and tens.
 */
function splitOn(symbols: readonly string[], separator: string): string[][] {
  const parts: string[][] = [[]];
  for (const sym of symbols) {
    if (sym === separator) parts.push([]);
    else (parts[parts.length - 1] as string[]).push(sym);
  }
  return parts;
}

/**
 * Reads a separator-free group: `[tens] [units]`.
 *
 * Returns null when the symbols are out of order or repeated — `፩፳` (units
 * before tens), `፩፪` (two units), `፲፳` (two tens).
 */
function readGroup(symbols: readonly string[], emptyIsOne: boolean): number | null {
  if (symbols.length === 0) return emptyIsOne ? 1 : 0;

  let tens: number | null = null;
  let units: number | null = null;

  for (const sym of symbols) {
    const ten = GEEZ_TENS[sym];
    if (ten !== undefined) {
      // Tens come first, and only one of them.
      if (tens !== null || units !== null) return null;
      tens = ten;
      continue;
    }
    // Separators are already gone, so anything else is a units symbol.
    if (units !== null) return null;
    units = GEEZ_UNITS[sym] as number;
  }

  return (tens ?? 0) + (units ?? 0);
}

/** Reads one `፼` part: `[group] ፻ [group]`, or a bare group. */
function readHundreds(symbols: readonly string[], emptyIsOne: boolean): number | null {
  const parts = splitOn(symbols, GEEZ_HUNDRED);
  if (parts.length > 2) return null; // at most one ፻ per part

  const first = parts[0] as string[];
  if (parts.length === 1) return readGroup(first, emptyIsOne);

  const hundreds = readGroup(first, true);
  const rest = readGroup(parts[1] as string[], false);
  if (hundreds === null || rest === null) return null;
  return hundreds * 100 + rest;
}

/**
 * Reads a complete run of Ge'ez numeral symbols.
 *
 * Returns the value, or `null` when the run is malformed — a units symbol
 * before a tens symbol, a repeated symbol, or more than one `፼` or `፻`. The
 * caller reports `AH1005`.
 */
export function readGeezNumeral(symbols: readonly string[]): number | null {
  if (symbols.length === 0) return null;

  const parts = splitOn(symbols, GEEZ_MYRIAD);
  if (parts.length > 2) return null; // at most one ፼

  const first = parts[0] as string[];
  if (parts.length === 1) return readHundreds(first, false);

  const myriads = readHundreds(first, true);
  const rest = readHundreds(parts[1] as string[], false);
  if (myriads === null || rest === null) return null;
  return myriads * 10000 + rest;
}
