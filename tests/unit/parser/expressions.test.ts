/** Expressions: precedence, associativity, access forms (LANGUAGE.md §6). */

import { describe, expect, it } from 'vitest';
import { codes, expression, messages, sx } from '../../helpers/parse.js';

describe('literals', () => {
  it.each([
    ['42', '42'],
    ['3.5', '3.5'],
    ['፳፩', '21'],
    ['"ሰላም"', '"ሰላም"'],
    ['እውነት', 'እውነት'],
    ['ሃሰት', 'ሃሰት'],
    ['ምንም', 'ምንም'],
    ['ቆጣሪ', 'ቆጣሪ'],
    ['[]', '[]'],
    ['[1፣ 2፣ 3]', '[1 2 3]'],
    ['[1, 2]', '[1 2]'],
  ])('%s parses as %s', (source, want) => {
    expect(sx(source)).toBe(want);
  });

  it('accepts a list literal spanning lines (§5.1)', () => {
    expect(sx('[\n    1፣\n    2\n]')).toBe('[1 2]');
  });

  it('accepts a nested list', () => {
    expect(sx('[[1]፣ [2፣ 3]]')).toBe('[[1] [2 3]]');
  });
});

describe('precedence, loosest to tightest (§6.1)', () => {
  it.each([
    // OR is looser than AND
    ['ሀ ወይም ለ እና ሐ', '(OR ሀ (AND ለ ሐ))'],
    ['ሀ እና ለ ወይም ሐ', '(OR (AND ሀ ለ) ሐ)'],
    // NOT is looser than comparison
    ['ተቃርኖ ሀ > ለ', '(NOT (GT ሀ ለ))'],
    ['ተቃርኖ ሀ እና ለ', '(AND (NOT ሀ) ለ)'],
    // comparison is looser than arithmetic
    ['ሀ + 1 > ለ * 2', '(GT (ADD ሀ 1) (MUL ለ 2))'],
    // + - looser than * / %
    ['1 + 2 * 3', '(ADD 1 (MUL 2 3))'],
    ['1 * 2 + 3', '(ADD (MUL 1 2) 3)'],
    ['1 + 2 % 3', '(ADD 1 (MOD 2 3))'],
    // ^ tighter than * /
    ['2 * 3 ^ 2', '(MUL 2 (POW 3 2))'],
    // postfix is tightest
    ['ሀ.ለ + 1', '(ADD (DOT ሀ ለ) 1)'],
    ['ሀ(1) * 2', '(MUL (CALL ሀ 1) 2)'],
  ])('%s is %s', (source, want) => {
    expect(sx(source)).toBe(want);
  });

  it('respects parentheses', () => {
    expect(sx('(1 + 2) * 3')).toBe('(MUL (ADD 1 2) 3)');
    expect(sx('ሀ እና (ለ ወይም ሐ)')).toBe('(AND ሀ (OR ለ ሐ))');
  });
});

describe('associativity (§6.1)', () => {
  it.each([
    ['1 - 2 - 3', '(SUB (SUB 1 2) 3)'],
    ['1 / 2 / 3', '(DIV (DIV 1 2) 3)'],
    ['ሀ ወይም ለ ወይም ሐ', '(OR (OR ሀ ለ) ሐ)'],
    ['ሀ እና ለ እና ሐ', '(AND (AND ሀ ለ) ሐ)'],
  ])('%s is left-associative: %s', (source, want) => {
    expect(sx(source)).toBe(want);
  });

  it('makes ^ right-associative', () => {
    expect(sx('2 ^ 3 ^ 2')).toBe('(POW 2 (POW 3 2))');
  });

  it('binds ^ tighter than unary minus on its left', () => {
    // -2 ^ 2 is -(2 ^ 2) = -4, not (-2) ^ 2 = 4.
    expect(sx('-2 ^ 2')).toBe('(NEG (POW 2 2))');
  });

  it('allows a unary exponent on the right', () => {
    expect(sx('2 ^ -1')).toBe('(POW 2 (NEG 1))');
  });

  it('stacks unary operators', () => {
    expect(sx('--1')).toBe('(NEG (NEG 1))');
    expect(sx('ተቃርኖ ተቃርኖ ሀ')).toBe('(NOT (NOT ሀ))');
  });
});

describe('comparison is non-associative (§6.1, CHANGES C39)', () => {
  it('reports AH2008 rather than computing (ሀ < ለ) < ሐ', () => {
    expect(codes('ሀ < ለ < ሐ')).toEqual(['AH2008']);
  });

  it.each(['ሀ < ለ < ሐ', 'ሀ == ለ == ሐ', 'ሀ > ለ >= ሐ', 'ሀ != ለ != ሐ'])('rejects %s', (source) => {
    expect(codes(source)).toEqual(['AH2008']);
  });

  it('accepts one comparison per chain', () => {
    expect(sx('ሀ < ለ እና ለ < ሐ')).toBe('(AND (LT ሀ ለ) (LT ለ ሐ))');
  });

  it('accepts a comparison inside parentheses on each side', () => {
    expect(codes('(ሀ < ለ) == እውነት')).toEqual([]);
  });
});

describe('symbol aliases parse identically to the words (§3.5)', () => {
  it.each([
    ['ሀ & ለ', 'ሀ እና ለ'],
    ['ሀ && ለ', 'ሀ እና ለ'],
    ['ሀ | ለ', 'ሀ ወይም ለ'],
    ['ሀ || ለ', 'ሀ ወይም ለ'],
    ['!ሀ', 'ተቃርኖ ሀ'],
  ])('%s matches %s', (symbol, word) => {
    expect(sx(symbol)).toBe(sx(word));
  });
});

describe('access (§6.4, §6.5)', () => {
  it.each([
    ['ዝ[0]', '(AT ዝ 0)'],
    ['ዝ[-1]', '(AT ዝ (NEG 1))'],
    ['ዝ[ቆጣሪ + 1]', '(AT ዝ (ADD ቆጣሪ 1))'],
    ['ዝ[1:3]', '(SLICE ዝ 1 3)'],
    ['ዝ[:3]', '(SLICE ዝ _ 3)'],
    ['ዝ[1:]', '(SLICE ዝ 1 _)'],
    ['ዝ[:]', '(SLICE ዝ _ _)'],
    ['ሀ.ለ', '(DOT ሀ ለ)'],
    ['ሀ.ለ.ሐ', '(DOT (DOT ሀ ለ) ሐ)'],
    ['ሀ()', '(CALL ሀ)'],
    ['ሀ(1፣ 2)', '(CALL ሀ 1 2)'],
    ['ሀ.ለ()', '(CALL (DOT ሀ ለ))'],
    ['ሀ(1)(2)', '(CALL (CALL ሀ 1) 2)'],
    ['ሀ[0].ለ', '(DOT (AT ሀ 0) ለ)'],
  ])('%s is %s', (source, want) => {
    expect(sx(source)).toBe(want);
  });

  it('accepts Ethiopic colon as the slice separator', () => {
    expect(sx('ዝ[1፡3]')).toBe('(SLICE ዝ 1 3)');
  });

  it('accepts an argument list spanning lines (§5.1)', () => {
    expect(sx('ጻፍ(\n    "ሀ"፣\n    "ለ"\n)')).toBe('(CALL ጻፍ "ሀ" "ለ")');
  });
});

describe('a keyword where a value belongs', () => {
  it('names the word-order mistake even mid-expression', () => {
    expect(codes('ሀ + ከሆነ')).toEqual(['AH2001']);
    expect(messages('ሀ + ከሆነ')[0]).toContain('ሁኔታው ከ"ከሆነ" በፊት');
  });

  it('names it for loops too', () => {
    expect(codes('ሀ + እስከሆነ ድረስ')).toEqual(['AH2001']);
    expect(messages('ሀ + እስከሆነ ድረስ')[0]).toContain('እስከሆነ ድረስ');
  });

  it('asks for a value when some other keyword turns up', () => {
    expect(codes('ሀ + ተግባር')).toEqual(['AH2001']);
    expect(messages('ሀ + ተግባር')[0]).toContain('ዋጋ ይጠበቃል');
  });

  it('reports a reserved word used as a value', () => {
    expect(codes('ሀ + አዲስ')).toEqual(['AH2010']);
  });
});

describe('trailing commas are not accepted (§3.4 grammar)', () => {
  it.each([
    ['[1፣]', 'a list literal'],
    ['ጻፍ(1፣)', 'an argument list'],
  ])('rejects %s (%s)', (source) => {
    expect(codes(source)).toEqual(['AH2001']);
    expect(messages(source)[0]).toContain('ኮማ');
  });
});

describe('the possessive የ form (§3.3, §6.4, CHANGES C23)', () => {
  it('reads የobj attr as a member access', () => {
    expect(sx('የሃይሌ ዕድሜ')).toBe('(OF ሃይሌ ዕድሜ)');
  });

  it('names the object without the prefix', () => {
    const node = expression('የሃይሌ ዕድሜ');
    expect(node.type).toBe('MemberAccess');
    if (node.type !== 'MemberAccess') return;
    expect(node.object).toMatchObject({ type: 'Identifier', name: 'ሃይሌ' });
    expect(node.property).toBe('ዕድሜ');
    // The የ is one code point, so the object's span starts just after it.
    expect(node.startCol).toBe(1);
    expect(node.object.startCol).toBe(2);
  });

  it('leaves a የ-prefixed name alone when no identifier follows', () => {
    expect(sx('የኔስም')).toBe('የኔስም');
    expect(sx('የኔስም + 1')).toBe('(ADD የኔስም 1)');
  });

  it('denotes the same thing as the dot form', () => {
    const of = expression('የሃይሌ ዕድሜ');
    const dot = expression('ሃይሌ.ዕድሜ');
    expect(of.type).toBe(dot.type);
    if (of.type !== 'MemberAccess' || dot.type !== 'MemberAccess') return;
    expect(of.property).toBe(dot.property);
    expect(of.spelling).toBe('of');
    expect(dot.spelling).toBe('dot');
  });
});
