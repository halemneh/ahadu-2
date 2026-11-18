/** The shared diagnostic shape and renderer (LANGUAGE.md §9.1, §9.2). */

import { describe, expect, it } from 'vitest';
import { diagnostic, formatDiagnostic, sortDiagnostics } from '../../src/diagnostics.js';
import { describeToken, isKeyword, readGeezNumeral } from '../../src/lexer/index.js';

describe('diagnostic()', () => {
  it('fills in the Amharic message for a known code', () => {
    expect(diagnostic('AH1001', 'lexer', 1, 1, 1).message).toBe('የማይታወቅ ካራክተር አለ።');
  });

  it('accepts an explicit message, for codes with a variable part', () => {
    const d = diagnostic('AH2001', 'parser', 3, 5, 7, 'የራሴ መልእክት');
    expect(d.message).toBe('የራሴ መልእክት');
  });

  it('falls back to the code when there is no message for it', () => {
    expect(diagnostic('AH9999', 'runtime', 1, 1, 1).message).toBe('AH9999');
  });
});

describe('formatDiagnostic()', () => {
  it('puts the code in brackets ahead of the Amharic text', () => {
    // The code is shown on every surface, not just --json, so a learner can
    // quote an error precisely when asking for help (§9.1).
    const d = diagnostic('AH1003', 'lexer', 3, 15, 20);
    expect(formatDiagnostic(d)).toBe('[AH1003] ያልተሟላ ፅሑፍ: መስመር 3 ላይ: 15ኛው ካራክተር');
  });
});

describe('sortDiagnostics()', () => {
  it('orders by line, then start column, then end column', () => {
    const unsorted = [
      diagnostic('AH1001', 'lexer', 2, 5, 5),
      diagnostic('AH1001', 'lexer', 1, 9, 9),
      diagnostic('AH1001', 'lexer', 2, 1, 4),
      diagnostic('AH1001', 'lexer', 2, 1, 2),
    ];
    expect(sortDiagnostics(unsorted).map((d) => [d.line, d.startCol, d.endCol])).toEqual([
      [1, 9, 9],
      [2, 1, 2],
      [2, 1, 4],
      [2, 5, 5],
    ]);
  });

  it('does not mutate its input', () => {
    const input = [diagnostic('AH1001', 'lexer', 2, 1, 1), diagnostic('AH1001', 'lexer', 1, 1, 1)];
    sortDiagnostics(input);
    expect(input[0]?.line).toBe(2);
  });
});

describe('token helpers', () => {
  const token = { type: 'KEYWORD', value: 'IF', line: 1, startCol: 1, endCol: 3 } as const;

  it('isKeyword matches type and sub-type together', () => {
    expect(isKeyword(token, 'IF')).toBe(true);
    expect(isKeyword(token, 'ELSE')).toBe(false);
    expect(isKeyword({ ...token, type: 'IDENTIFIER' }, 'IF')).toBe(false);
  });

  it('describeToken omits a null value', () => {
    expect(describeToken({ type: 'THEN', value: null, line: 2, startCol: 7, endCol: 7 })).toBe(
      'THEN@2:7-7',
    );
  });

  it('describeToken includes a value when there is one', () => {
    expect(describeToken(token)).toBe('KEYWORD:IF@1:1-3');
  });
});

describe('readGeezNumeral rejects repeated separators', () => {
  it('allows at most one of each', () => {
    expect(readGeezNumeral(['፻', '፩', '፻'])).toBeNull();
    expect(readGeezNumeral(['፩', '፼', '፪', '፼'])).toBeNull();
  });

  it('still reads a run that uses each separator once', () => {
    expect(readGeezNumeral(['፩', '፼', '፪', '፻', '፴', '፬'])).toBe(10234);
  });
});
