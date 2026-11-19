/**
 * Finding the error under the pointer (TOOLING.md §2.2).
 *
 * The editor is a textarea with its text painted behind it, so there is no
 * element to hover — the position is arithmetic. Width is measured through an
 * injected function, which is what lets this be tested without a browser: the
 * fake below gives every character the same width, so the expected columns can
 * be worked out by hand.
 */

import { describe, expect, it } from 'vitest';
import { covers, diagnosticAt, positionAt } from '../../../tools/playground/locate.js';
import type { EditorMetrics, Measure } from '../../../tools/playground/locate.js';
import type { Position } from '../../../tools/playground/view.js';
import { analyse } from '../../../tools/playground/view.js';
import { diagnostic } from '../../../src/diagnostics.js';

/** Ten pixels per code point, so x = 25 is the middle of the third character. */
const measure: Measure = (text) => [...text].length * 10;

const metrics: EditorMetrics = {
  lineHeight: 20,
  paddingTop: 10,
  paddingLeft: 10,
  scrollTop: 0,
  scrollLeft: 0,
};

function at(source: string, x: number, y: number, m: Partial<EditorMetrics> = {}): Position {
  return positionAt(source, x, y, { ...metrics, ...m }, measure);
}

describe('positionAt', () => {
  const source = 'ሀለሐመሠ\nረሰሸ';

  it('puts the first line under the first row of pixels', () => {
    expect(at(source, 12, 12).line).toBe(1);
    expect(at(source, 12, 29).line).toBe(1);
  });

  it('moves to the next line a line-height down', () => {
    expect(at(source, 12, 31).line).toBe(2);
  });

  it('clamps above the first line and below the last', () => {
    expect(at(source, 12, -50).line).toBe(1);
    expect(at(source, 12, 9999).line).toBe(2);
  });

  it('accounts for vertical scroll', () => {
    expect(at(source, 12, 12, { scrollTop: 20 }).line).toBe(2);
  });

  it('puts the first column at the left padding', () => {
    expect(at(source, 10, 12).column).toBe(1);
    expect(at(source, 0, 12).column).toBe(1);
    expect(at(source, -40, 12).column).toBe(1);
  });

  it('advances a column past each character’s midpoint, as a caret does', () => {
    // Character 1 spans x 10–20, so its midpoint is 15.
    expect(at(source, 14, 12).column).toBe(1);
    expect(at(source, 16, 12).column).toBe(2);
    expect(at(source, 24, 12).column).toBe(2);
    expect(at(source, 26, 12).column).toBe(3);
  });

  it('stops one past the last character', () => {
    // Five characters on line 1.
    expect(at(source, 9999, 12).column).toBe(6);
  });

  it('accounts for horizontal scroll', () => {
    expect(at(source, 12, 12, { scrollLeft: 30 }).column).toBe(4);
  });

  it('puts an empty line at its first column', () => {
    expect(at('ሀ\n\nለ', 50, 32)).toEqual({ line: 2, column: 1 });
  });

  it('counts columns in code points, matching every other position (§2.2)', () => {
    // Two astral characters: four UTF-16 units, two columns.
    const astral = '\u{1F600}\u{1F600}';
    expect(at(astral, 9999, 12).column).toBe(3);
  });
});

describe('covers', () => {
  const d = diagnostic('AH3003', 'runtime', 2, 5, 9, 'በዘሮ');

  it('is true across the whole inclusive span', () => {
    for (const column of [5, 6, 7, 8, 9]) {
      expect(covers(d, { line: 2, column }), `column ${column}`).toBe(true);
    }
  });

  it('is false just outside it', () => {
    expect(covers(d, { line: 2, column: 4 })).toBe(false);
    expect(covers(d, { line: 2, column: 10 })).toBe(false);
  });

  it('is false on another line', () => {
    expect(covers(d, { line: 1, column: 6 })).toBe(false);
    expect(covers(d, { line: 3, column: 6 })).toBe(false);
  });

  it('covers a span that points one past the end of a line', () => {
    // Which is where a token that was expected and not found is reported.
    const missing = diagnostic('AH2001', 'parser', 1, 14, 14, '"፦" ይጠበቃል።');
    expect(covers(missing, { line: 1, column: 14 })).toBe(true);
  });
});

describe('diagnosticAt', () => {
  const wide = diagnostic('AH2008', 'parser', 1, 1, 20, 'chain');
  const narrow = diagnostic('AH1001', 'lexer', 1, 7, 7, 'char');

  it('returns nothing when the pointer is over clean code', () => {
    expect(diagnosticAt([wide], { line: 2, column: 1 })).toBeNull();
    expect(diagnosticAt([], { line: 1, column: 1 })).toBeNull();
  });

  it('returns the one whose span covers the position', () => {
    expect(diagnosticAt([wide], { line: 1, column: 3 })?.code).toBe('AH2008');
  });

  it('prefers the narrowest match, so a precise error is not buried', () => {
    expect(diagnosticAt([wide, narrow], { line: 1, column: 7 })?.code).toBe('AH1001');
    expect(diagnosticAt([narrow, wide], { line: 1, column: 7 })?.code).toBe('AH1001');
  });

  it('falls back to the wider one away from the narrow span', () => {
    expect(diagnosticAt([wide, narrow], { line: 1, column: 3 })?.code).toBe('AH2008');
  });
});

describe('over a real program', () => {
  const source = 'ሀ = 1 $ 2';
  const { diagnostics } = analyse(source);

  it('finds the illegal character where it is', () => {
    // The $ is the seventh code point.
    const found = diagnosticAt(diagnostics, { line: 1, column: 7 });
    expect(found?.code).toBe('AH1001');
  });

  it('finds nothing over the code either side of it', () => {
    expect(diagnosticAt(diagnostics, { line: 1, column: 1 })).toBeNull();
  });

  it('agrees with the position the pointer arithmetic gives', () => {
    // x inside the seventh character: 10 + 6*10 .. 10 + 7*10.
    const at7 = positionAt(source, 65, 12, metrics, measure);
    expect(diagnosticAt(diagnostics, at7)?.code).toBe('AH1001');
  });
});
