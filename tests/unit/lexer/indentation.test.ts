/** Indentation (LANGUAGE.md §3.7) and error recovery (§3.9). */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { codes, shape, types } from '../../helpers/lex.js';

describe('indent levels', () => {
  it('reads four spaces as one level', () => {
    expect(types('ሀ\n    ለ')).toEqual(['IDENTIFIER', 'NEWLINE', 'INDENT', 'IDENTIFIER']);
  });

  it('reads a tab as one level', () => {
    expect(types('ሀ\n\tለ')).toEqual(['IDENTIFIER', 'NEWLINE', 'INDENT', 'IDENTIFIER']);
  });

  it('reads eight spaces as two levels', () => {
    expect(types('ሀ\n        ለ')).toEqual([
      'IDENTIFIER',
      'NEWLINE',
      'INDENT',
      'INDENT',
      'IDENTIFIER',
    ]);
  });

  it('counts a tab as four columns when mixed with spaces', () => {
    // Two spaces plus a tab normalizes to six: one level, two left over.
    expect(codes('ሀ\n  \tለ')).toEqual(['AH1002']);
  });

  it('accepts a tab and four spaces as two levels', () => {
    expect(types('ሀ\n\t    ለ')).toEqual([
      'IDENTIFIER',
      'NEWLINE',
      'INDENT',
      'INDENT',
      'IDENTIFIER',
    ]);
  });

  it('spans the source columns an indent came from', () => {
    expect(shape('    ሀ')).toEqual(['INDENT@1:1-4', 'IDENTIFIER:ሀ@1:5-5']);
  });

  it('gives a tab a one-column span', () => {
    expect(shape('\tሀ')).toEqual(['INDENT@1:1-1', 'IDENTIFIER:ሀ@1:2-2']);
  });

  it('keeps the column of what follows an indent right', () => {
    expect(shape('        ሀ')).toEqual(['INDENT@1:1-4', 'INDENT@1:5-8', 'IDENTIFIER:ሀ@1:9-9']);
  });
});

describe('partial indentation is an error (§3.7)', () => {
  it.each([
    [' ', 1],
    ['  ', 2],
    ['   ', 3],
    ['     ', 1],
  ])('reports AH1002 for %o leading spaces', (ws) => {
    expect(codes(`${ws}ሀ`)).toEqual(['AH1002']);
  });

  it('reports at the first leftover column', () => {
    const { diagnostics } = tokenize('      ሀ');
    expect(diagnostics[0]).toMatchObject({ code: 'AH1002', line: 1, startCol: 5, endCol: 6 });
  });

  it('still emits the whole levels it did find', () => {
    expect(types('      ሀ')).toEqual(['INDENT', 'IDENTIFIER']);
  });

  it('keeps lexing the rest of the file', () => {
    const { tokens, diagnostics } = tokenize('  ሀ\nለ');
    expect(diagnostics.map((d) => d.code)).toEqual(['AH1002']);
    expect(tokens.map((t) => t.type)).toEqual(['IDENTIFIER', 'NEWLINE', 'IDENTIFIER', 'EOF']);
  });
});

describe('blank lines (§3.7)', () => {
  it('produces no INDENT for a whitespace-only line', () => {
    expect(types('ሀ\n    \nለ')).toEqual(['IDENTIFIER', 'NEWLINE', 'NEWLINE', 'IDENTIFIER']);
  });

  it('does not report AH1002 for odd whitespace on a blank line', () => {
    expect(codes('ሀ\n  \nለ')).toEqual([]);
  });

  it('treats a comment-only line as blank', () => {
    expect(types('ሀ\n  # አስተያየት\nለ')).toEqual(['IDENTIFIER', 'NEWLINE', 'NEWLINE', 'IDENTIFIER']);
    expect(codes('ሀ\n  # አስተያየት\nለ')).toEqual([]);
  });

  it('treats trailing whitespace at end of input as blank', () => {
    expect(codes('ሀ\n  ')).toEqual([]);
  });
});

describe('indentation inside brackets (§3.7, §5.1)', () => {
  it('carries no meaning, so a multi-line list literal is legal', () => {
    const src = 'ቤተሰብ = [\n    "ሀ"፣\n  "ለ"\n]';
    expect(codes(src)).toEqual([]);
    expect(types(src).filter((t) => t === 'INDENT')).toEqual([]);
  });

  it('resumes once the bracket closes', () => {
    const src = 'ሀ(\n1\n)\n  ለ';
    expect(codes(src)).toEqual(['AH1002']);
  });

  it('survives an unbalanced closing bracket', () => {
    expect(() => tokenize(')\n  ሀ')).not.toThrow();
    expect(codes(')\n  ሀ')).toEqual(['AH1002']);
  });

  it('handles nesting', () => {
    const src = 'ሀ([\n  1\n])\n    ለ';
    expect(codes(src)).toEqual([]);
    expect(types(src).filter((t) => t === 'INDENT')).toEqual(['INDENT']);
  });
});

describe('error recovery (§3.9)', () => {
  it('reports an unknown character once and moves on', () => {
    const { tokens, diagnostics } = tokenize('ሀ $ ለ');
    expect(diagnostics.map((d) => d.code)).toEqual(['AH1001']);
    expect(tokens.map((t) => t.type)).toEqual(['IDENTIFIER', 'IDENTIFIER', 'EOF']);
  });

  it('points at the offending column', () => {
    const { diagnostics } = tokenize('ሀ $');
    expect(diagnostics[0]).toMatchObject({ line: 1, startCol: 3, endCol: 3 });
  });

  it('collects several problems rather than stopping at the first', () => {
    expect(codes('$ ሀ\n  ለ\n"ያልተዘጋ')).toEqual(['AH1001', 'AH1002', 'AH1003']);
  });

  it('returns diagnostics in source order', () => {
    const { diagnostics } = tokenize('ሀ\n$ $\n  ለ');
    const positions = diagnostics.map((d) => [d.line, d.startCol]);
    expect(positions).toEqual([
      [2, 1],
      [2, 3],
      [3, 1],
    ]);
  });

  it('carries the Amharic message and the code', () => {
    const { diagnostics } = tokenize('$');
    expect(diagnostics[0]).toMatchObject({
      code: 'AH1001',
      message: 'የማይታወቅ ካራክተር አለ።',
      stage: 'lexer',
    });
  });
});
