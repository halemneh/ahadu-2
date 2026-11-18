/** Number literals, ASCII and Ge'ez (LANGUAGE.md §3.4, §3.4.1). */

import { describe, expect, it } from 'vitest';
import { readGeezNumeral } from '../../../src/lexer/index.js';
import { codes, shape, types, values } from '../../helpers/lex.js';

describe('ASCII number literals', () => {
  it.each([
    ['0', 0],
    ['7', 7],
    ['42', 42],
    ['3.5', 3.5],
    ['0.25', 0.25],
    ['1000000', 1000000],
  ])('reads %s as %s', (src, value) => {
    expect(values(src)).toEqual([value]);
  });

  it('spans the whole literal', () => {
    expect(shape('3.5')).toEqual(['NUMBER:3.5@1:1-3']);
  });

  it('takes at most one dot, so 1.2.3 is three tokens', () => {
    expect(shape('1.2.3')).toEqual(['NUMBER:1.2@1:1-3', 'DOT@1:4-4', 'NUMBER:3@1:5-5']);
  });

  it('needs a digit after the dot, so 5. is a number then a dot', () => {
    expect(shape('5.')).toEqual(['NUMBER:5@1:1-1', 'DOT@1:2-2']);
  });

  it('needs a digit before the dot, so .5 is a dot then a number', () => {
    expect(shape('.5')).toEqual(['DOT@1:1-1', 'NUMBER:5@1:2-2']);
  });

  it('leaves the sign to the MINUS operator (§3.4)', () => {
    // Negative numbers exist; the sign is simply not part of the literal,
    // which is what keeps 5-3 three tokens rather than two numbers.
    expect(shape('-5')).toEqual(['MINUS@1:1-1', 'NUMBER:5@1:2-2']);
    expect(types('5-3')).toEqual(['NUMBER', 'MINUS', 'NUMBER']);
  });

  it('does not treat a digit as the start of an identifier', () => {
    expect(types('1ሀ')).toEqual(['NUMBER', 'IDENTIFIER']);
  });
});

describe("Ge'ez numeral literals", () => {
  it.each([
    ['፩', 1],
    ['፱', 9],
    ['፲', 10],
    ['፺', 90],
    ['፳፩', 21],
    ['፺፱', 99],
    ['፻', 100],
    ['፻፩', 101],
    ['፫፻', 300],
    ['፫፻፳፩', 321],
    ['፱፻፺፱', 999],
    ['፼', 10000],
    ['፪፼', 20000],
    ['፪፼፫፻፳፩', 20321],
  ])('reads %s as %s', (src, value) => {
    expect(values(src)).toEqual([value]);
    expect(codes(src)).toEqual([]);
  });

  it('spans the whole run', () => {
    expect(shape('፫፻፳፩')).toEqual(['NUMBER:321@1:1-4']);
  });

  it('is an input spelling only — the value is an ordinary number', () => {
    expect(values('፳፩ + ፩')).toEqual([21, null, 1]);
  });

  it.each([
    ['፩፳', 'units before tens'],
    ['፩፪', 'two units'],
    ['፲፳', 'two tens'],
    ['፼፼', 'two myriads'],
    ['፻፻', 'two hundreds'],
  ])('reports %s as AH1005 (%s)', (src) => {
    expect(codes(src)).toEqual(['AH1005']);
  });

  it('still emits a placeholder token for a malformed run', () => {
    // So the parser can carry on structurally; the diagnostic is what stops
    // the program from running.
    expect(types('ጻፍ(፩፳)')).toEqual(['IDENTIFIER', 'LPAREN', 'NUMBER', 'RPAREN']);
  });

  it('does not mix with ASCII digits in one literal', () => {
    // Two adjacent number literals — a parse error, not a number (§3.4.1).
    expect(shape('፳1')).toEqual(['NUMBER:20@1:1-1', 'NUMBER:1@1:2-2']);
    expect(shape('1፳')).toEqual(['NUMBER:1@1:1-1', 'NUMBER:20@1:2-2']);
  });

  it('is not part of an identifier (§3.1)', () => {
    expect(types('ሀ፩')).toEqual(['IDENTIFIER', 'NUMBER']);
  });
});

describe('readGeezNumeral directly', () => {
  it('returns null for an empty run', () => {
    expect(readGeezNumeral([])).toBeNull();
  });

  it('treats an empty group before a separator as 1', () => {
    expect(readGeezNumeral(['፻'])).toBe(100);
    expect(readGeezNumeral(['፼'])).toBe(10000);
  });

  it('treats an empty group after a separator as 0', () => {
    expect(readGeezNumeral(['፪', '፻'])).toBe(200);
    expect(readGeezNumeral(['፪', '፼'])).toBe(20000);
  });

  it('combines both separators', () => {
    expect(readGeezNumeral(['፩', '፼', '፪', '፻', '፴', '፬'])).toBe(10234);
  });
});
