/**
 * Turning a pointer position into a place in the source (TOOLING.md §2.2).
 *
 * The editor is a textarea with the text drawn behind it, so the browser will
 * not tell us which error the pointer is over — there are no element bounds to
 * hit, only painted characters. The arithmetic is done here instead.
 *
 * Two things make that tractable. The editor does not wrap, so a pixel row
 * maps to exactly one source line. And width is measured through an injected
 * function, so this file needs no canvas, no DOM and no font — which is what
 * lets it be tested.
 */

import { codePoints } from '../../src/interpreter/values.js';
import type { Diagnostic } from '../../src/diagnostics.js';
import type { Position } from './view.js';

/** The editor's geometry, read from the DOM by the caller. */
export interface EditorMetrics {
  readonly lineHeight: number;
  readonly paddingTop: number;
  readonly paddingLeft: number;
  readonly scrollTop: number;
  readonly scrollLeft: number;
}

/** Measures the rendered width of a string in the editor's font. */
export type Measure = (text: string) => number;

/**
 * Where a point inside the editor falls.
 *
 * `x` and `y` are relative to the editor's own box. The column is found by
 * walking the line and stopping at the character whose midpoint the pointer
 * has passed — the same rule a caret follows, so the answer agrees with where
 * a click would put the cursor.
 *
 * Columns count code points, like everything else that reports a position
 * (LANGUAGE.md §2.2).
 */
export function positionAt(
  source: string,
  x: number,
  y: number,
  metrics: EditorMetrics,
  measure: Measure,
): Position {
  const lines = source.split('\n');

  const row = Math.floor((y + metrics.scrollTop - metrics.paddingTop) / metrics.lineHeight);
  const line = Math.min(Math.max(row, 0), lines.length - 1);
  const chars = codePoints(lines[line] ?? '');

  const target = x + metrics.scrollLeft - metrics.paddingLeft;
  if (target <= 0) return { line: line + 1, column: 1 };

  let before = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const after = measure(chars.slice(0, i + 1).join(''));
    if (target < (before + after) / 2) return { line: line + 1, column: i + 1 };
    before = after;
  }

  return { line: line + 1, column: chars.length + 1 };
}

/** Whether a diagnostic's span covers a position. */
export function covers(d: Diagnostic, at: Position): boolean {
  if (d.line !== at.line) return false;
  // An inclusive span, and a diagnostic may point one past the last character
  // when something was expected and not found (§9.1).
  return at.column >= d.startCol && at.column <= d.endCol;
}

/**
 * The diagnostic under a position, or null.
 *
 * The narrowest match wins, so a precise error inside a wider one is the one
 * explained rather than the one buried.
 */
export function diagnosticAt(diagnostics: readonly Diagnostic[], at: Position): Diagnostic | null {
  let best: Diagnostic | null = null;
  let width = Number.POSITIVE_INFINITY;

  for (const d of diagnostics) {
    if (!covers(d, at)) continue;
    const span = d.endCol - d.startCol;
    if (span < width) {
      best = d;
      width = span;
    }
  }

  return best;
}
