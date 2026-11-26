/**
 * Numbers print without an exponent (LANGUAGE.md §4.2, §8.1).
 */

import { describe, expect, it } from 'vitest';
import { plainDecimal } from '../../../src/interpreter/values.js';

describe('plainDecimal', () => {
  it.each([
    ['1e+21', '1000000000000000000000'],
    ['1.5e+22', '15000000000000000000000'],
    ['1e-7', '0.0000001'],
    ['-1.25e-7', '-0.000000125'],
    ['1.2345e+3', '1234.5'],
    ['42', '42'],
    ['3.25', '3.25'],
  ])('%s → %s', (input, expected) => {
    expect(plainDecimal(input)).toBe(expected);
  });

  it('reads back as the same number', () => {
    for (const n of [1e21, 1.7976931348623157e308, 5e-324, 1e-7, -2.5e30]) {
      expect(Number(plainDecimal(String(n)))).toBe(n);
    }
  });
});
