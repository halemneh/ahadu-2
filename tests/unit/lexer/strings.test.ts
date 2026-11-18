/** String literals (LANGUAGE.md §3.6). */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { codes, shape, values } from '../../helpers/lex.js';

const ZWJ = '‍';
const BOM = '﻿';

describe('string literals', () => {
  it('reads a double-quoted string', () => {
    expect(values('"ሰላም ዓለም"')).toEqual(['ሰላም ዓለም']);
  });

  it('reads a single-quoted string', () => {
    expect(values("'ሰላም'")).toEqual(['ሰላም']);
  });

  it('spans both delimiters', () => {
    expect(shape('"ሰላም"')).toEqual(['STRING:ሰላም@1:1-5']);
  });

  it('is closed only by the delimiter that opened it', () => {
    expect(values(`"it's"`)).toEqual(["it's"]);
    expect(values(`'say "hi"'`)).toEqual(['say "hi"']);
  });

  it('reads an empty string', () => {
    expect(shape('""')).toEqual(['STRING:@1:1-2']);
  });
});

describe('escape sequences', () => {
  it.each([
    ['"ሀ\\nለ"', 'ሀ\nለ', 'newline'],
    ['"ሀ\\tለ"', 'ሀ\tለ', 'tab'],
    ['"ሀ\\\\ለ"', 'ሀ\\ለ', 'backslash'],
    ['"ሀ\\"ለ"', 'ሀ"ለ', 'double quote'],
    ["'ሀ\\'ለ'", "ሀ'ለ", 'single quote'],
  ])('decodes %s (%s)', (src, want) => {
    expect(values(src)).toEqual([want]);
    expect(codes(src)).toEqual([]);
  });

  it('leaves an unrecognized escape as the character itself', () => {
    expect(values('"\\q"')).toEqual(['q']);
  });
});

describe('unterminated strings', () => {
  it('reports AH1003 at a line break and keeps what it scanned', () => {
    const { tokens, diagnostics } = tokenize('"ያልተዘጋ\nሀ');
    expect(tokens.map((t) => t.type)).toEqual(['STRING', 'NEWLINE', 'IDENTIFIER', 'EOF']);
    expect(tokens[0]?.value).toBe('ያልተዘጋ');
    expect(diagnostics.map((d) => d.code)).toEqual(['AH1003']);
  });

  it('spans the opening delimiter to the last character scanned (CHANGES C40)', () => {
    // v1-py reported this a line early, with a column that counted string
    // characters rather than source columns.
    const { diagnostics } = tokenize('ጻፍ("ያልተዘጋ\n');
    expect(diagnostics[0]).toMatchObject({ code: 'AH1003', line: 1, startCol: 4, endCol: 9 });
  });

  it('reports AH1003 at end of input', () => {
    const { tokens, diagnostics } = tokenize('"ያልተዘጋ');
    expect(tokens.map((t) => t.type)).toEqual(['STRING', 'EOF']);
    expect(diagnostics.map((d) => d.code)).toEqual(['AH1003']);
  });

  it('treats a trailing backslash as escaping the delimiter', () => {
    expect(codes('"ሀ\\"')).toEqual(['AH1003']);
  });

  it('does not swallow the newline, so the line count stays right', () => {
    const { tokens } = tokenize('"ሀ\nለ');
    expect(tokens.at(-2)).toMatchObject({ type: 'IDENTIFIER', line: 2 });
  });
});

describe('invisible characters inside strings (§2.1)', () => {
  it('keeps them, because a string is data', () => {
    expect(values(`"ሰ${ZWJ}ላም"`)).toEqual([`ሰ${ZWJ}ላም`]);
  });

  it('keeps a BOM too', () => {
    expect(values(`"ሀ${BOM}ለ"`)).toEqual([`ሀ${BOM}ለ`]);
  });
});

describe('strings are code-point sequences (§4.3)', () => {
  it('counts an astral character as one column', () => {
    // A single code point outside the BMP, which is two UTF-16 units.
    const { tokens } = tokenize('"\u{1F600}"');
    expect(tokens[0]).toMatchObject({ startCol: 1, endCol: 3 });
    expect([...String(tokens[0]?.value)].length).toBe(1);
  });
});
