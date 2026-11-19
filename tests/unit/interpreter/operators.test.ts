/** Operators (LANGUAGE.md §6.2) and indexing (§6.5). */

import { describe, expect, it } from 'vitest';
import { code, message, out, shows } from '../../helpers/evaluate.js';

describe('arithmetic on numbers (§6.2)', () => {
  it.each([
    ['2 + 3', '5'],
    ['2 - 3', '-1'],
    ['2 * 3', '6'],
    ['7 / 2', '3.5'],
    ['7 % 3', '1'],
    ['-7 % 3', '-1'],
    ['7 % -3', '1'],
    ['2 ^ 10', '1024'],
    ['2 ^ 3 ^ 2', '512'],
    ['-2 ^ 2', '-4'],
    ['2 ^ -1', '0.5'],
    ['2 ^ 0.5', '1.4142135623730951'],
    ['1 + 2 * 3', '7'],
    ['(1 + 2) * 3', '9'],
    ['-(3 - 5)', '2'],
  ])('%s is %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('takes the sign of the left operand for %', () => {
    expect(shows('-7 % 3')).toBe('-1');
  });

  it('refuses division by zero', () => {
    expect(code('ጻፍ(1 / 0)')).toBe('AH3003');
    expect(message('ጻፍ(1 / 0)')).toContain('በዘሮ');
  });

  it('refuses modulo by zero, and says so in its own words', () => {
    expect(code('ጻፍ(1 % 0)')).toBe('AH3003');
    expect(message('ጻፍ(1 % 0)')).toContain('ቀሪ');
  });

  it('refuses a negative base with a fractional exponent (CHANGES C38)', () => {
    // v1-py returned a complex number here.
    expect(code('ጻፍ((0 - 8) ^ 0.5)')).toBe('AH3004');
  });

  it('allows a negative base with a whole exponent', () => {
    expect(shows('(0 - 2) ^ 3')).toBe('-8');
  });

  it('refuses a result that overflows rather than producing infinity (§4.2)', () => {
    expect(code('ጻፍ(10 ^ 400)')).toBe('AH3006');
    expect(code('ጻፍ(10 ^ 308 * 10)')).toBe('AH3006');
  });
});

describe('strings (§6.2)', () => {
  it('concatenates with +', () => {
    expect(shows('"ሰላም " + "ዓለም"')).toBe('ሰላም ዓለም');
  });

  it('repeats with *', () => {
    expect(shows('"ሀ" * 3')).toBe('ሀሀሀ');
    expect(shows('"ሀ" * 0')).toBe('');
  });

  it('refuses a repeat count that is not a whole number at or above zero', () => {
    expect(code('ጻፍ("ሀ" * -1)')).toBe('AH3002');
    expect(code('ጻፍ("ሀ" * 1.5)')).toBe('AH3002');
    expect(code('ጻፍ("ሀ" * "ለ")')).toBe('AH3002');
  });

  it('compares in code-point order', () => {
    expect(shows('"ሀ" < "ለ"')).toBe('እውነት');
    expect(shows('"ለ" < "ሀ"')).toBe('ሃሰት');
    expect(shows('"ሀ" <= "ሀ"')).toBe('እውነት');
    expect(shows('"ሀለ" > "ሀ"')).toBe('እውነት');
  });

  it('refuses mixing a string and a number with +', () => {
    expect(code('ጻፍ("ሰላም" + 5)')).toBe('AH3002');
    expect(message('ጻፍ("ሰላም" + 5)')).toContain('ጽሁፍ');
    expect(message('ጻፍ("ሰላም" + 5)')).toContain('ቁጥር');
  });
});

describe('lists (§6.2, CHANGES C15)', () => {
  it('concatenates with +, rather than appending', () => {
    // v1-py's + appended the right operand as one element: [1] + [2] gave
    // [1, [2]].
    expect(shows('[1] + [2]')).toBe('[1፣ 2]');
    expect(shows('[1፣ 2] + [3፣ 4]')).toBe('[1፣ 2፣ 3፣ 4]');
    expect(shows('[] + []')).toBe('[]');
  });

  it('builds a new list and leaves both operands alone', () => {
    expect(out('ሀ = [1]\nለ = [2]\nሐ = ሀ + ለ\nጻፍ(ሀ)\nጻፍ(ለ)\nጻፍ(ሐ)')).toEqual([
      '[1]',
      '[2]',
      '[1፣ 2]',
    ]);
  });

  it('refuses mixing a list with anything else', () => {
    expect(code('ጻፍ([1] + 2)')).toBe('AH3002');
    expect(code('ጻፍ([1] * 2)')).toBe('AH3002');
  });
});

describe('comparison (§6.2)', () => {
  it.each([
    ['1 < 2', 'እውነት'],
    ['2 < 1', 'ሃሰት'],
    ['1 <= 1', 'እውነት'],
    ['2 > 1', 'እውነት'],
    ['1 >= 2', 'ሃሰት'],
    ['1 ‹ 2', 'እውነት'],
    ['2 › 1', 'እውነት'],
  ])('%s is %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('refuses ordering values of different types', () => {
    expect(code('ጻፍ(1 < "ሀ")')).toBe('AH3002');
    expect(code('ጻፍ(ምንም < 1)')).toBe('AH3002');
    expect(code('ጻፍ([1] < [2])')).toBe('AH3002');
  });
});

describe('logic (§6.2)', () => {
  it.each([
    ['እውነት እና እውነት', 'እውነት'],
    ['እውነት እና ሃሰት', 'ሃሰት'],
    ['ሃሰት ወይም እውነት', 'እውነት'],
    ['ሃሰት ወይም ሃሰት', 'ሃሰት'],
    ['ተቃርኖ እውነት', 'ሃሰት'],
    ['ተቃርኖ ሃሰት', 'እውነት'],
    ['እውነት & እውነት', 'እውነት'],
    ['ሃሰት | እውነት', 'እውነት'],
    ['!ሃሰት', 'እውነት'],
  ])('%s is %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('short-circuits እና, leaving the right operand unevaluated', () => {
    // If the right side ran, the undefined name would be AH3001.
    expect(shows('ሃሰት እና ያልተገለጸ')).toBe('ሃሰት');
  });

  it('short-circuits ወይም', () => {
    expect(shows('እውነት ወይም ያልተገለጸ')).toBe('እውነት');
  });

  it('does not type-check an operand it never evaluates (§6.2)', () => {
    expect(shows('ሃሰት እና 5')).toBe('ሃሰት');
    expect(shows('እውነት ወይም 5')).toBe('እውነት');
  });

  it('refuses a non-boolean operand it does evaluate', () => {
    expect(code('ጻፍ(5 እና እውነት)')).toBe('AH3002');
    expect(code('ጻፍ(እውነት እና 5)')).toBe('AH3002');
    expect(code('ጻፍ(ተቃርኖ 5)')).toBe('AH3002');
    expect(message('ጻፍ(እውነት እና 5)')).toContain('እና');
  });
});

describe('ምንም takes part in equality only (§4.6)', () => {
  it('compares', () => {
    expect(shows('ምንም == ምንም')).toBe('እውነት');
    expect(shows('ምንም != ምንም')).toBe('ሃሰት');
  });

  it('refuses everything else', () => {
    expect(code('ጻፍ(ምንም + 1)')).toBe('AH3002');
    expect(code('ጻፍ(ምንም + ምንም)')).toBe('AH3002');
    expect(code('ጻፍ(ተቃርኖ ምንም)')).toBe('AH3002');
  });
});

describe('unary minus', () => {
  it('negates a number', () => {
    expect(shows('-5')).toBe('-5');
    expect(shows('--5')).toBe('5');
  });

  it('refuses anything else', () => {
    expect(code('ጻፍ(-"ሀ")')).toBe('AH3002');
    expect(code('ጻፍ(-እውነት)')).toBe('AH3002');
  });
});
