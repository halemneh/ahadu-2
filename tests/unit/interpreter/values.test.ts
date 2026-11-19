/** Values, equality and rendering (LANGUAGE.md §4, §6.3, §8.1). */

import { describe, expect, it } from 'vitest';
import {
  codePoints,
  compareStrings,
  render,
  stringLength,
  valuesEqual,
} from '../../../src/interpreter/index.js';
import { bool, list, num, str, NOTHING } from '../../../src/interpreter/index.js';
import { out, shows, value } from '../../helpers/evaluate.js';

describe('rendering numbers (§4.2, CHANGES C30)', () => {
  it.each([
    ['0', '0'],
    ['42', '42'],
    ['3.5', '3.5'],
    ['-7', '-7'],
    // An integral result has no decimal point: 2, not 2.0.
    ['4 / 2', '2'],
    ['6 / 3', '2'],
    ['10 / 4', '2.5'],
    ['0 - 0', '0'],
    ['-0.0', '0'],
  ])('%s shows as %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });
});

describe('rendering other types (§8.1)', () => {
  it.each([
    ['እውነት', 'እውነት'],
    ['ሃሰት', 'ሃሰት'],
    ['ምንም', 'ምንም'],
    ['"ሰላም"', 'ሰላም'],
    ['[]', '[]'],
    ['[1፣ 2፣ 3]', '[1፣ 2፣ 3]'],
    // A string is quoted only inside a list, so ጻፍ("ሀ") shows ሀ and
    // ጻፍ(["ሀ"]) shows ["ሀ"].
    ['["ሀ"]', '["ሀ"]'],
    ['[["ሀ"]፣ 1]', '[["ሀ"]፣ 1]'],
    ['[እውነት፣ ምንም]', '[እውነት፣ ምንም]'],
  ])('%s shows as %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('shows a function by name', () => {
    expect(out('ተግባር ሰላም_በል()፦\n    ተመላሽ 1\n\nጻፍ(ሰላም_በል)')).toEqual(['[ተግባር ሰላም_በል]']);
  });

  it('shows a built-in like any other function', () => {
    expect(shows('ጻፍ')).toBe('[ተግባር ጻፍ]');
  });

  it('shows a class and an object of it', () => {
    const source = ['ክላስ ተማሪ፦', '    ስም = ""', '', 'ጻፍ(ተማሪ)', 'ጻፍ(ተማሪ())'].join('\n');
    expect(out(source)).toEqual(['[ክላስ ተማሪ]', '[ተማሪ ኦብጀክት]']);
  });

  it('shows a bound method as a function', () => {
    const source = [
      'ክላስ ሀ፦',
      '    ለ = 1',
      '',
      '    ተግባር ሐ()፦',
      '        ተመላሽ 1',
      '',
      'ጻፍ(ሀ().ሐ)',
    ].join('\n');
    expect(out(source)).toEqual(['[ተግባር ሐ]']);
  });
});

describe('type names, which አይነት reports (§4.1)', () => {
  it.each([
    ['1', 'ቁጥር'],
    ['እውነት', 'እውነታ'],
    ['"ሀ"', 'ጽሁፍ'],
    ['[]', 'ስብስብ'],
    ['ምንም', 'ምንም'],
    ['ጻፍ', 'ተግባር'],
  ])('አይነት(%s) is %s', (expression, want) => {
    expect(shows(`አይነት(${expression})`)).toBe(want);
  });
});

describe('equality (§6.3)', () => {
  it.each([
    ['1 == 1', 'እውነት'],
    ['1 == 2', 'ሃሰት'],
    ['"ሀ" == "ሀ"', 'እውነት'],
    ['"ሀ" == "ለ"', 'ሃሰት'],
    ['እውነት == እውነት', 'እውነት'],
    ['ምንም == ምንም', 'እውነት'],
    ['[1፣ 2] == [1፣ 2]', 'እውነት'],
    ['[1፣ 2] == [1፣ 3]', 'ሃሰት'],
    ['[1] == [1፣ 2]', 'ሃሰት'],
    ['[[1]] == [[1]]', 'እውነት'],
    ['1 != 2', 'እውነት'],
    ['1 != 1', 'ሃሰት'],
  ])('%s is %s', (expression, want) => {
    expect(shows(expression)).toBe(want);
  });

  it('compares across types as ሃሰት rather than failing', () => {
    // "Are these the same?" is a fair question about any two values (§6.3).
    expect(shows('1 == "1"')).toBe('ሃሰት');
    expect(shows('ምንም == 0')).toBe('ሃሰት');
    expect(shows('[] == ምንም')).toBe('ሃሰት');
    expect(shows('እውነት == 1')).toBe('ሃሰት');
    expect(shows('1 != "1"')).toBe('እውነት');
  });

  it('compares lists by value even though they are references (§4.5)', () => {
    expect(out('ሀ = [1፣ 2]\nለ = [1፣ 2]\nጻፍ(ሀ == ለ)')).toEqual(['እውነት']);
  });

  it('compares objects by identity', () => {
    const source = [
      'ክላስ ሀ፦',
      '    ለ = 1',
      '',
      'አንድ = ሀ()',
      'ሁለት = ሀ()',
      'ጻፍ(አንድ == አንድ)',
      'ጻፍ(አንድ == ሁለት)',
    ].join('\n');
    expect(out(source)).toEqual(['እውነት', 'ሃሰት']);
  });
});

describe('the value model directly', () => {
  it('renders each kind', () => {
    expect(render(num(1))).toBe('1');
    expect(render(bool(true))).toBe('እውነት');
    expect(render(str('ሀ'))).toBe('ሀ');
    expect(render(str('ሀ'), true)).toBe('"ሀ"');
    expect(render(NOTHING)).toBe('ምንም');
    expect(render(list([num(1), str('ሀ')]))).toBe('[1፣ "ሀ"]');
  });

  it('treats identical scalars as equal', () => {
    expect(valuesEqual(num(1), num(1))).toBe(true);
    expect(valuesEqual(num(1), str('1'))).toBe(false);
    expect(valuesEqual(NOTHING, NOTHING)).toBe(true);
  });

  it('counts and splits strings by code point (§4.3)', () => {
    expect(stringLength('ሰላም')).toBe(3);
    expect(codePoints('ሰላም')).toEqual(['ሰ', 'ላ', 'ም']);
    // An astral character is one code point, two UTF-16 units.
    expect(stringLength('\u{1F600}')).toBe(1);
    expect(codePoints('\u{1F600}')).toHaveLength(1);
    expect('\u{1F600}'.length).toBe(2);
  });

  it('orders strings by code point, not by UTF-16 unit', () => {
    expect(compareStrings('ሀ', 'ለ')).toBeLessThan(0);
    expect(compareStrings('ለ', 'ሀ')).toBeGreaterThan(0);
    expect(compareStrings('ሀ', 'ሀ')).toBe(0);
    expect(compareStrings('ሀ', 'ሀለ')).toBeLessThan(0);
    // U+1F600 is above every BMP code point, which UTF-16 unit order gets wrong.
    expect(compareStrings('\u{1F600}', '�')).toBeGreaterThan(0);
  });
});

describe('the last statement’s value is what the REPL prints (TOOLING.md §1.2)', () => {
  it('is the value of a trailing expression', () => {
    expect(value('1 + 2')).toBe('3');
    expect(value('"ሀ" + "ለ"')).toBe('ሀለ');
  });

  it('is null when the last statement produced ምንም', () => {
    expect(value('ሀ = 1')).toBeNull();
    expect(value('ጻፍ("ሀ")')).toBeNull();
  });
});
