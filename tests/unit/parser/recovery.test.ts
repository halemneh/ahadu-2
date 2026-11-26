/**
 * Error recovery (LANGUAGE.md §9.3).
 *
 * The parser never throws, always returns a program, and reports once per bad
 * line. The last of those is what makes the diagnostics usable: without it,
 * one missing bracket turns into a column of errors that buries the real one.
 */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { parse } from '../../../src/parser/index.js';
import { codes, messages, parseSource } from '../../helpers/parse.js';

describe('never throws', () => {
  it.each([
    '',
    '\n\n',
    '(',
    ')',
    '[',
    ']',
    '=',
    '.',
    '፦',
    '።',
    'ከሆነ',
    'ግን',
    'ተግባር',
    'ክላስ',
    'ተመላሽ',
    'ሀ =',
    'ሀ[',
    'ሀ(',
    'ጻፍ(',
    '1 +',
    'ተቃርኖ',
    '    ',
    'ሀ ከሆነ፦',
    'ክላስ ሀ(',
    '[1፣',
    'ሀ.',
    '፩፳',
  ])('survives %o', (source) => {
    expect(() => parseSource(source)).not.toThrow();
    expect(parseSource(source).program.type).toBe('Program');
  });

  it('survives a token stream with nothing but EOF', () => {
    const { tokens } = tokenize('');
    expect(() => parse(tokens)).not.toThrow();
  });

  it('terminates on deeply nested brackets', () => {
    const source = `${'('.repeat(200)}1${')'.repeat(200)}`;
    expect(() => parseSource(source)).not.toThrow();
  });

  /*
   * Each of these overflowed the JavaScript stack — a RangeError out of a
   * parser that promises never to throw — until nesting was limited (§9.3).
   * Each is now one AH2016, and nothing else.
   */
  describe('never runs out of stack', () => {
    const blocks = (n: number): string =>
      Array.from({ length: n }, (_, i) => `${'    '.repeat(i)}እውነት ከሆነ፦`).join('\n') +
      `\n${'    '.repeat(n)}ጻፍ(1)`;

    it.each([
      ['a thousand brackets', `ጻፍ(${'('.repeat(1000)}1${')'.repeat(1000)})`],
      ['twenty thousand minus signs', `ጻፍ(${'-'.repeat(20000)}1)`],
      ['twenty thousand ተቃርኖ', `ጻፍ(${'ተቃርኖ '.repeat(20000)}እውነት)`],
      ['twenty thousand powers', `ጻፍ(1${' ^ 1'.repeat(20000)})`],
      ['a two-thousand-term sum', `ጻፍ(1${' + 1'.repeat(2000)})`],
      ['two hundred nested blocks', blocks(200)],
    ])('%s', (_, source) => {
      expect(codes(source)).toEqual(['AH2016']);
    });

    it('leaves what a person writes alone', () => {
      expect(parseSource(`ጻፍ(${'('.repeat(90)}1${')'.repeat(90)})`).diagnostics).toEqual([]);
      expect(parseSource(`ጻፍ(1${' + 1'.repeat(300)})`).diagnostics).toEqual([]);
      expect(parseSource(blocks(40)).diagnostics).toEqual([]);
    });
  });
});

describe('one report per bad line', () => {
  it('reports a missing closing paren once', () => {
    expect(codes('ጻፍ(1')).toEqual(['AH2002']);
  });

  it('names the line the bracket was opened on', () => {
    const source = 'ጻፍ(\n    1\n    2';
    expect(messages(source)[0]).toContain('መስመር 1');
  });

  it('reports a missing closing bracket once', () => {
    expect(codes('ዝ = [1፣ 2')).toEqual(['AH2002']);
  });

  it('does not cascade from one bad line to the next', () => {
    const source = ['ሀ = = 1', 'ለ = 2', 'ሐ = 3'].join('\n');
    expect(codes(source)).toHaveLength(1);
  });

  it('keeps parsing the lines after a bad one', () => {
    // The bad line still yields a statement, with a placeholder where the
    // value should have been, so the two good lines are not the only survivors.
    const { program } = parseSource(['ሀ = = 1', 'ለ = 2', 'ሐ = 3'].join('\n'));
    expect(program.body).toHaveLength(3);
    expect(program.body[0]).toMatchObject({ value: { type: 'InvalidExpression' } });
  });

  it('recovers at the next line after a failed block opener', () => {
    // The orphaned body line is swallowed, not reported again; the line after
    // the block is parsed normally.
    const source = ['እውነት ከሆነ', '    ጻፍ(1)', 'ጻፍ(2)'].join('\n');
    expect(codes(source)).toEqual(['AH2001']);
    const { program } = parseSource(source);
    expect(program.body.map((s) => s.type)).toEqual(['IfStatement', 'ExpressionStatement']);
  });

  it('reports each genuinely separate mistake', () => {
    const source = ['ሀ = = 1', 'ለ < ሐ < መ'].join('\n');
    expect(codes(source)).toEqual(['AH2001', 'AH2008']);
  });
});

describe('placeholders keep the tree shaped like the source (§9.3)', () => {
  it('stands in for an expression that could not be parsed', () => {
    const { program } = parseSource('ሀ = ');
    expect(program.body).toHaveLength(1);
    expect(program.body[0]).toMatchObject({
      type: 'AssignmentStatement',
      value: { type: 'InvalidExpression' },
    });
  });

  it('keeps the call it did manage to read', () => {
    const { program } = parseSource('ጻፍ(1');
    expect(program.body[0]).toMatchObject({
      type: 'ExpressionStatement',
      expression: { type: 'CallExpression', args: [{ type: 'NumberLiteral', value: 1 }] },
    });
  });

  it('gives a placeholder a real position', () => {
    const { program } = parseSource('ሀ = ');
    const statement = program.body[0];
    if (statement?.type !== 'AssignmentStatement') throw new Error('expected an assignment');
    expect(statement.value.line).toBe(1);
    expect(statement.value.startCol).toBeGreaterThan(0);
  });
});

describe('diagnostics are well formed', () => {
  it('come back in source order', () => {
    const source = ['ሀ < ለ < ሐ', 'መ = = 1'].join('\n');
    const { diagnostics } = parseSource(source);
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2]);
  });

  it('are all tagged as the parser stage', () => {
    const { diagnostics } = parseSource('ሀ < ለ < ሐ');
    expect(diagnostics.every((d) => d.stage === 'parser')).toBe(true);
  });

  it('carry a span that points inside the line', () => {
    const { diagnostics } = parseSource('ጻፍ(1');
    const d = diagnostics[0];
    expect(d?.startCol).toBeGreaterThanOrEqual(1);
    expect(d?.endCol).toBeGreaterThanOrEqual(d?.startCol ?? 1);
  });

  it('carry Amharic text, not a code alone', () => {
    const { diagnostics } = parseSource('ጻፍ(1');
    expect(diagnostics[0]?.message).not.toBe('AH2002');
    expect(diagnostics[0]?.message.length).toBeGreaterThan(5);
  });
});

describe('a half-typed file still parses usefully', () => {
  it('reads the lines above the one being typed', () => {
    const source = ['ቆጣሪ = 0', 'ቆጣሪ < 5 እስከሆነ ድረስ፦', '    ጻፍ(ቆ'].join('\n');
    const { program } = parseSource(source);
    expect(program.body).toHaveLength(2);
    expect(program.body[1]?.type).toBe('WhileStatement');
  });

  it('reads a condition that is still being written', () => {
    const { program } = parseSource('ዕድሜ >');
    expect(program.body).toHaveLength(1);
    expect(program.body[0]).toMatchObject({
      type: 'ExpressionStatement',
      expression: { type: 'BinaryExpression', operator: 'GT' },
    });
  });
});
