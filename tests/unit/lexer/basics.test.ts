/** Stream shape, line breaks, comments, whitespace (LANGUAGE.md §2.2–2.3, §3.8). */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import type { Token } from '../../../src/lexer/index.js';
import { codes, shape, types } from '../../helpers/lex.js';

const BOM = '﻿';

function span(t: Token | undefined): string {
  return t ? `${t.type}@${t.line}:${t.startCol}-${t.endCol}` : 'none';
}

describe('token stream shape', () => {
  it('ends with exactly one EOF', () => {
    const { tokens } = tokenize('ሀ = 1');
    expect(tokens.filter((t) => t.type === 'EOF')).toHaveLength(1);
    expect(tokens.at(-1)?.type).toBe('EOF');
  });

  it('puts EOF at 1:1 for empty input', () => {
    const { tokens, diagnostics } = tokenize('');
    expect(tokens).toHaveLength(1);
    expect(span(tokens.at(-1))).toBe('EOF@1:1-1');
    expect(diagnostics).toEqual([]);
  });

  it('puts EOF at 1:1 for BOM-only input', () => {
    const { tokens, diagnostics } = tokenize(BOM);
    expect(tokens).toHaveLength(1);
    expect(span(tokens.at(-1))).toBe('EOF@1:1-1');
    expect(diagnostics).toEqual([]);
  });

  it('skips a leading BOM without consuming a column', () => {
    expect(shape(`${BOM}ሀ`)).toEqual(['IDENTIFIER:ሀ@1:1-1']);
  });

  it('reports a BOM that is not at the start', () => {
    expect(codes(`ሀ${BOM}ለ`)).toEqual(['AH1001']);
  });

  it('never throws, whatever the input', () => {
    const nasty = ['', BOM, '"', '\\', '#', '\r', '፼፼', '    ', '!', 'የ', '​'];
    for (const src of nasty) {
      expect(() => tokenize(src), src).not.toThrow();
    }
  });

  it('decodes raw UTF-8 bytes', () => {
    const bytes = new TextEncoder().encode('ሀ = 1');
    expect(tokenize(bytes).tokens.map((t) => t.type)).toEqual([
      'IDENTIFIER',
      'ASSIGN',
      'NUMBER',
      'EOF',
    ]);
  });

  it('reports malformed UTF-8 as an illegal character rather than aborting', () => {
    // 0xFF is never valid UTF-8; it decodes to U+FFFD, which is then illegal.
    const bytes = new Uint8Array([0xff, 0x31]);
    const { tokens, diagnostics } = tokenize(bytes);
    expect(diagnostics.map((d) => d.code)).toEqual(['AH1001']);
    expect(tokens.map((t) => t.type)).toEqual(['NUMBER', 'EOF']);
  });
});

describe('line terminators', () => {
  it.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
    ['CR', '\r'],
  ])('treats %s as one NEWLINE', (_name, nl) => {
    expect(types(`ሀ${nl}ለ`)).toEqual(['IDENTIFIER', 'NEWLINE', 'IDENTIFIER']);
  });

  it('counts lines across a CRLF', () => {
    expect(shape('ሀ\r\nለ')).toEqual(['IDENTIFIER:ሀ@1:1-1', 'NEWLINE@1:2-2', 'IDENTIFIER:ለ@2:1-1']);
  });

  it('counts lines across a lone CR', () => {
    expect(shape('ሀ\rለ')).toEqual(['IDENTIFIER:ሀ@1:1-1', 'NEWLINE@1:2-2', 'IDENTIFIER:ለ@2:1-1']);
  });

  it('puts EOF on the line after a trailing newline', () => {
    expect(span(tokenize('ሀ\n').tokens.at(-1))).toBe('EOF@2:1-1');
  });

  it('emits a NEWLINE for a blank line', () => {
    expect(types('ሀ\n\nለ')).toEqual(['IDENTIFIER', 'NEWLINE', 'NEWLINE', 'IDENTIFIER']);
  });
});

describe('comments', () => {
  it('produces no tokens', () => {
    expect(types('# አስተያየት\nሀ')).toEqual(['NEWLINE', 'IDENTIFIER']);
  });

  it('runs only to the end of the line', () => {
    expect(types('ሀ # አስተያየት\nለ')).toEqual(['IDENTIFIER', 'NEWLINE', 'IDENTIFIER']);
  });

  it('terminates at end of input with no trailing newline (CHANGES C22)', () => {
    // v1-py hung forever here: its comment loop never checked for end of input.
    expect(types('ሀ\n# መጨረሻ')).toEqual(['IDENTIFIER', 'NEWLINE']);
  });

  it('is ordinary text inside a string', () => {
    expect(shape('"ሀ # ለ"')).toEqual(['STRING:ሀ # ለ@1:1-7']);
  });
});

describe('mid-line whitespace', () => {
  it('separates tokens and produces nothing', () => {
    expect(types('ሀ   +\t\tለ')).toEqual(['IDENTIFIER', 'PLUS', 'IDENTIFIER']);
  });

  it('still advances the column', () => {
    expect(shape('ሀ  ለ')).toEqual(['IDENTIFIER:ሀ@1:1-1', 'IDENTIFIER:ለ@1:4-4']);
  });
});
