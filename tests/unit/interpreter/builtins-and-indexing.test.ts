/** The seven built-ins (§8) and indexing/slicing (§6.5). */

import { describe, expect, it } from 'vitest';
import { code, message, out, runSource, shows } from '../../helpers/evaluate.js';

const lines = (...source: string[]): string => source.join('\n');

describe('ጻፍ (§8)', () => {
  it('prints one value', () => {
    expect(out('ጻፍ("ሰላም")')).toEqual(['ሰላም']);
  });

  it('is variadic, space-separating its arguments (CHANGES C31)', () => {
    // v1-py accepted exactly one argument, and its "wrong arity" message was
    // the empty string.
    expect(out('ጻፍ("ዕድሜ፦"፣ 22)')).toEqual(['ዕድሜ፦ 22']);
    expect(out('ጻፍ(1፣ 2፣ 3)')).toEqual(['1 2 3']);
  });

  it('prints an empty line for no arguments', () => {
    expect(out('ጻፍ()')).toEqual(['']);
  });

  it('is an ordinary binding that user code may shadow (§8)', () => {
    expect(out(lines('ጻፍ_ተቀመጠ = ጻፍ', 'ጻፍ_ተቀመጠ("በሌላ ስም")'))).toEqual(['በሌላ ስም']);
  });
});

describe('ርዝመት (§8, CHANGES C28)', () => {
  it('counts a list', () => {
    expect(shows('ርዝመት([1፣ 2፣ 3])')).toBe('3');
    expect(shows('ርዝመት([])')).toBe('0');
  });

  it('counts a string in code points (§4.3)', () => {
    expect(shows('ርዝመት("ሰላም")')).toBe('3');
    expect(shows('ርዝመት("")')).toBe('0');
  });

  it('makes a loop over a list of unknown length writable', () => {
    // Without it, every v1 example had to hardcode its bound.
    const source = lines(
      'ዝ = [10፣ 20፣ 30]',
      'ቆጣሪ = 0',
      'ቆጣሪ < ርዝመት(ዝ) እስከሆነ ድረስ፦',
      '    ጻፍ(ዝ[ቆጣሪ])',
      '    ቆጣሪ = ቆጣሪ + 1',
    );
    expect(out(source)).toEqual(['10', '20', '30']);
  });

  it('refuses a type with no length', () => {
    expect(code('ጻፍ(ርዝመት(1))')).toBe('AH3002');
    expect(code('ጻፍ(ርዝመት(ምንም))')).toBe('AH3002');
  });

  it('checks its arity', () => {
    expect(code('ጻፍ(ርዝመት())')).toBe('AH3010');
    expect(code('ጻፍ(ርዝመት([]፣ 1))')).toBe('AH3010');
  });
});

describe('አዋህድ and ሰርዝ change the list (§4.5, §8)', () => {
  it('appends in place and returns ምንም', () => {
    expect(out(lines('ዝ = [1]', 'ጻፍ(አዋህድ(ዝ፣ 2))', 'ጻፍ(ዝ)'))).toEqual(['ምንም', '[1፣ 2]']);
  });

  it('makes the mistaken reassignment fail loudly (§8)', () => {
    // ዝ = አዋህድ(ዝ፣ 4) leaves ዝ holding ምንም rather than looking like it worked.
    expect(out(lines('ዝ = [1]', 'ዝ = አዋህድ(ዝ፣ 2)', 'ጻፍ(ዝ)'))).toEqual(['ምንም']);
  });

  it('appends one element, whatever it is', () => {
    expect(out(lines('ዝ = [1]', 'አዋህድ(ዝ፣ [2])', 'ጻፍ(ዝ)'))).toEqual(['[1፣ [2]]']);
  });

  it('removes by index, in place', () => {
    expect(out(lines('ዝ = [1፣ 2፣ 3]', 'ሰርዝ(ዝ፣ 1)', 'ጻፍ(ዝ)'))).toEqual(['[1፣ 3]']);
  });

  it('removes from the end with a negative index', () => {
    expect(out(lines('ዝ = [1፣ 2፣ 3]', 'ሰርዝ(ዝ፣ -1)', 'ጻፍ(ዝ)'))).toEqual(['[1፣ 2]']);
  });

  it('reports an index outside the list', () => {
    expect(code('ዝ = [1]\nሰርዝ(ዝ፣ 5)')).toBe('AH3008');
    expect(code('ዝ = []\nሰርዝ(ዝ፣ 0)')).toBe('AH3008');
  });

  it('refuses anything that is not a list', () => {
    expect(code('አዋህድ("ሀ"፣ 1)')).toBe('AH3002');
    expect(code('ሰርዝ(1፣ 0)')).toBe('AH3002');
  });

  it('checks arity', () => {
    expect(code('ዝ = []\nአዋህድ(ዝ)')).toBe('AH3010');
    expect(code('ዝ = []\nሰርዝ(ዝ)')).toBe('AH3010');
  });

  it('is visible through every name for the list (§4.5)', () => {
    const source = lines('ሀ = [1]', 'ለ = ሀ', 'አዋህድ(ለ፣ 2)', 'ጻፍ(ሀ)');
    expect(out(source)).toEqual(['[1፣ 2]']);
  });
});

describe('ቅጂ (§8)', () => {
  it('gives an independent list', () => {
    const source = lines('ሀ = [1፣ 2]', 'ለ = ቅጂ(ሀ)', 'ለ[0] = 9', 'ጻፍ(ሀ)', 'ጻፍ(ለ)');
    expect(out(source)).toEqual(['[1፣ 2]', '[9፣ 2]']);
  });

  it('is shallow, so a nested list is still shared', () => {
    const source = lines('ውስጥ = [1]', 'ሀ = [ውስጥ]', 'ለ = ቅጂ(ሀ)', 'አዋህድ(ለ[0]፣ 2)', 'ጻፍ(ውስጥ)');
    expect(out(source)).toEqual(['[1፣ 2]']);
  });

  it('matches what a full slice does', () => {
    expect(out(lines('ሀ = [1፣ 2]', 'ጻፍ(ቅጂ(ሀ) == ሀ[:])'))).toEqual(['እውነት']);
  });

  it('refuses a non-list', () => {
    expect(code('ጻፍ(ቅጂ("ሀ"))')).toBe('AH3002');
  });
});

describe('አይነት (§8)', () => {
  it('names a type as a string', () => {
    expect(shows('አይነት(1)')).toBe('ቁጥር');
    expect(shows('አይነት(አይነት(1))')).toBe('ጽሁፍ');
  });

  it('checks its arity', () => {
    expect(code('ጻፍ(አይነት())')).toBe('AH3010');
  });
});

describe('አንብብ (§8)', () => {
  it('reads a line', () => {
    const result = runSource('ስም = አንብብ()\nጻፍ("ሰላም " + ስም)', { input: ['ኃይለሚካኤል'] });
    expect(result.errors).toEqual([]);
    expect(result.output).toEqual(['ሰላም ኃይለሚካኤል']);
  });

  it('prints its prompt first', () => {
    const result = runSource('ስም = አንብብ("ስምህ፦ ")\nጻፍ(ስም)', { input: ['ሀ'] });
    expect(result.output).toEqual(['ስምህ፦ ', 'ሀ']);
  });

  it('always yields a string', () => {
    const result = runSource('ጻፍ(አይነት(አንብብ()))', { input: ['42'] });
    expect(result.output).toEqual(['ጽሁፍ']);
  });

  it('refuses more than one argument', () => {
    expect(code('አንብብ("ሀ"፣ "ለ")')).toBe('AH3010');
  });
});

describe('indexing (§6.5)', () => {
  it.each([
    ['[10፣ 20፣ 30][0]', '10'],
    ['[10፣ 20፣ 30][2]', '30'],
    ['[10፣ 20፣ 30][-1]', '30'],
    ['[10፣ 20፣ 30][-3]', '10'],
    ['"ሰላም"[0]', 'ሰ'],
    ['"ሰላም"[-1]', 'ም'],
  ])('%s is %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('accepts a negative index all the way to the first element (CHANGES C27)', () => {
    // v1-py bounds-checked the absolute value, so x[-n] was rejected while
    // x[-1] worked.
    expect(shows('[1፣ 2፣ 3፣ 4፣ 5][-5]')).toBe('1');
  });

  it('reports an index outside the range, both ways', () => {
    expect(code('ጻፍ([1፣ 2፣ 3][3])')).toBe('AH3008');
    expect(code('ጻፍ([1፣ 2፣ 3][-4])')).toBe('AH3008');
    expect(code('ጻፍ([][0])')).toBe('AH3008');
    expect(message('ጻፍ([1፣ 2፣ 3][3])')).toContain('3');
  });

  it('requires a whole number', () => {
    expect(code('ጻፍ([1፣ 2][0.5])')).toBe('AH3007');
    expect(code('ጻፍ([1፣ 2]["ሀ"])')).toBe('AH3007');
    expect(message('ጻፍ([1፣ 2]["ሀ"])')).toContain('ጽሁፍ');
  });

  it('refuses indexing a type that has no elements', () => {
    expect(code('ጻፍ(1[0])')).toBe('AH3002');
    expect(code('ጻፍ(ምንም[0])')).toBe('AH3002');
  });

  it('yields a one-character string, which is the character (§4.3)', () => {
    expect(out('ሀ = "ሰላም"[0]\nጻፍ(አይነት(ሀ))\nጻፍ(ርዝመት(ሀ))')).toEqual(['ጽሁፍ', '1']);
  });
});

describe('slicing (§6.5, CHANGES C16)', () => {
  it.each([
    ['[1፣ 2፣ 3][:]', '[1፣ 2፣ 3]'],
    ['[1፣ 2፣ 3][1:]', '[2፣ 3]'],
    ['[1፣ 2፣ 3][:2]', '[1፣ 2]'],
    ['[1፣ 2፣ 3][1:2]', '[2]'],
    ['[1፣ 2፣ 3][0:0]', '[]'],
    ['[1፣ 2፣ 3][2:1]', '[]'],
    ['[1፣ 2፣ 3][5:9]', '[]'],
    ['[1፣ 2፣ 3][-2:]', '[2፣ 3]'],
    ['[1፣ 2፣ 3][:-1]', '[1፣ 2]'],
  ])('%s is %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('keeps the last element for an open end', () => {
    // v1-py defaulted the end to n-1 and silently dropped it.
    expect(shows('[1፣ 2፣ 3][:]')).toBe('[1፣ 2፣ 3]');
    expect(shows('"ሰላም"[:]')).toBe('ሰላም');
    expect(shows('[1፣ 2፣ 3][1:]')).toBe('[2፣ 3]');
  });

  it('slices a string by code point', () => {
    expect(shows('"ሰላም"[0:2]')).toBe('ሰላ');
    expect(shows('"ኃይለሚካኤል"[0:4]')).toBe('ኃይለሚ');
  });

  it('clamps rather than failing on range', () => {
    expect(shows('[1፣ 2][0:99]')).toBe('[1፣ 2]');
    expect(shows('"ሀ"[0:99]')).toBe('ሀ');
  });

  it('produces a new list that does not alias its source', () => {
    const source = lines('ሀ = [1፣ 2]', 'ለ = ሀ[:]', 'ለ[0] = 9', 'ጻፍ(ሀ)', 'ጻፍ(ለ)');
    expect(out(source)).toEqual(['[1፣ 2]', '[9፣ 2]']);
  });

  it('refuses slicing a type that cannot be sliced', () => {
    expect(code('ጻፍ(1[0:1])')).toBe('AH3002');
  });
});

describe('index assignment (§6.5)', () => {
  it('replaces an element', () => {
    expect(out('ዝ = [1፣ 2፣ 3]\nዝ[0] = 9\nጻፍ(ዝ)')).toEqual(['[9፣ 2፣ 3]']);
  });

  it('accepts a negative index', () => {
    expect(out('ዝ = [1፣ 2፣ 3]\nዝ[-1] = 9\nጻፍ(ዝ)')).toEqual(['[1፣ 2፣ 9]']);
  });

  it('cannot extend a list — that is what አዋህድ is for (§6.5)', () => {
    expect(code('ዝ = [1፣ 2፣ 3]\nዝ[3] = 4')).toBe('AH3008');
  });

  it('refuses a string target, and says what to do instead (§4.3)', () => {
    expect(code('ስም = "ሰላም"\nስም[0] = "ሀ"')).toBe('AH3015');
  });

  it('refuses any other target type', () => {
    expect(code('ሀ = 1\nሀ[0] = 2')).toBe('AH3002');
  });

  it('is visible through every name for the list', () => {
    expect(out('ሀ = [1]\nለ = ሀ\nለ[0] = 9\nጻፍ(ሀ)')).toEqual(['[9]']);
  });
});
