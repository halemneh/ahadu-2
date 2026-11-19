/** Operators and punctuation, ASCII and Ethiopic (LANGUAGE.md §3.5). */

import { describe, expect, it } from 'vitest';
import { codes, lex, shape, types, values } from '../../helpers/lex.js';

describe('single-character operators', () => {
  it.each([
    ['+', 'PLUS'],
    ['-', 'MINUS'],
    ['*', 'STAR'],
    ['/', 'SLASH'],
    ['%', 'PERCENT'],
    ['^', 'CARET'],
    ['=', 'ASSIGN'],
    ['<', 'LT'],
    ['>', 'GT'],
    ['(', 'LPAREN'],
    [')', 'RPAREN'],
    ['[', 'LBRACKET'],
    [']', 'RBRACKET'],
    [',', 'COMMA'],
    ['.', 'DOT'],
    [':', 'COLON'],
  ])('%s is %s', (src, type) => {
    expect(types(src)).toEqual([type]);
    expect(codes(src)).toEqual([]);
  });
});

describe('two-character operators win over one (§3.5)', () => {
  it.each([
    ['==', 'EQ'],
    ['!=', 'NEQ'],
    ['<=', 'LTE'],
    ['>=', 'GTE'],
    [':-', 'THEN'],
  ])('%s is one %s', (src, type) => {
    expect(types(src)).toEqual([type]);
  });

  it('does not read != as NOT then ASSIGN', () => {
    expect(shape('!=')).toEqual(['NEQ@1:1-2']);
  });

  it('does not read <= as LT then ASSIGN', () => {
    expect(shape('<=')).toEqual(['LTE@1:1-2']);
  });

  it('keeps a trailing = separate when it is not part of the operator', () => {
    expect(types('< =')).toEqual(['LT', 'ASSIGN']);
  });
});

describe('Ethiopic spellings are exactly equivalent (§3.5)', () => {
  it.each([
    ['‹', 'LT'],
    ['›', 'GT'],
    ['፣', 'COMMA'],
    ['፡', 'COLON'],
    ['፦', 'THEN'],
    ['።', 'STOP'],
  ])('%s is %s', (src, type) => {
    expect(types(src)).toEqual([type]);
    expect(codes(src)).toEqual([]);
  });

  it.each([
    ['‹=', 'LTE'],
    ['›=', 'GTE'],
    ['፡-', 'THEN'],
  ])('%s is %s', (src, type) => {
    expect(types(src)).toEqual([type]);
  });

  it('produces identical tokens for either spelling of a block opener', () => {
    expect(types('ከሆነ፦')).toEqual(types('ከሆነ:-'));
  });

  it('reads : as the slice separator inside brackets, never as :- (§3.5)', () => {
    // A block cannot open inside an unclosed bracket, but a slice with a
    // negative end can: ዝ[:-1] must not lex :- as a block opener.
    expect(types('ዝ[:-1]')).toEqual([
      'IDENTIFIER',
      'LBRACKET',
      'COLON',
      'MINUS',
      'NUMBER',
      'RBRACKET',
    ]);
    expect(types('ዝ[1:-1]')).toEqual([
      'IDENTIFIER',
      'LBRACKET',
      'NUMBER',
      'COLON',
      'MINUS',
      'NUMBER',
      'RBRACKET',
    ]);
  });

  it('still reads :- as a block opener outside brackets', () => {
    expect(types('ከሆነ:-')).toEqual(['KEYWORD', 'THEN']);
  });

  it('reads ፦ as a block opener even inside brackets, being one code point', () => {
    expect(types('(፦)')).toEqual(['LPAREN', 'THEN', 'RPAREN']);
  });
});

describe('symbol aliases for word operators (§3.5, CHANGES C09)', () => {
  it.each([
    ['&', 'AND'],
    ['&&', 'AND'],
    ['|', 'OR'],
    ['||', 'OR'],
    ['!', 'NOT'],
  ])('%s is KEYWORD:%s', (src, sub) => {
    expect(types(src)).toEqual(['KEYWORD']);
    expect(values(src)).toEqual([sub]);
  });

  it('produces the same token as the Amharic word, so precedence need not care', () => {
    expect(lex('ሀ & ለ').map((t) => t.value)).toEqual(lex('ሀ እና ለ').map((t) => t.value));
    expect(lex('ሀ | ለ').map((t) => t.value)).toEqual(lex('ሀ ወይም ለ').map((t) => t.value));
    expect(lex('!ሀ').map((t) => t.value)).toEqual(lex('ተቃርኖ ሀ').map((t) => t.value));
  });

  it('spans both characters of a doubled form', () => {
    expect(shape('&&')).toEqual(['KEYWORD:AND@1:1-2']);
  });
});

describe('a realistic line', () => {
  it('tokenizes a condition-first conditional', () => {
    expect(shape('ዕድሜ > 18 ከሆነ፦')).toEqual([
      'IDENTIFIER:ዕድሜ@1:1-3',
      'GT@1:5-5',
      'NUMBER:18@1:7-8',
      'KEYWORD:IF@1:10-12',
      'THEN@1:13-13',
    ]);
  });

  it('tokenizes a call with Ethiopic commas', () => {
    expect(types('ጻፍ("ሀ"፣ 1)')).toEqual([
      'IDENTIFIER',
      'LPAREN',
      'STRING',
      'COMMA',
      'NUMBER',
      'RPAREN',
    ]);
  });

  it('tokenizes a slice', () => {
    expect(types('ስም[0:4]')).toEqual([
      'IDENTIFIER',
      'LBRACKET',
      'NUMBER',
      'COLON',
      'NUMBER',
      'RBRACKET',
    ]);
  });

  it('treats ። as a statement terminator alongside a newline', () => {
    expect(types('ሀ = 1። ለ = 2')).toEqual([
      'IDENTIFIER',
      'ASSIGN',
      'NUMBER',
      'STOP',
      'IDENTIFIER',
      'ASSIGN',
      'NUMBER',
    ]);
  });
});
