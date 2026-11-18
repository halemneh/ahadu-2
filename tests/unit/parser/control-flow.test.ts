/**
 * Conditionals and loops (LANGUAGE.md §7.3–7.4).
 *
 * The condition comes **before** the keyword. This is the divergence from
 * v1-ts that made every original Ahadu program unparseable under it
 * (CHANGES C01), so it gets tested from several directions.
 */

import { describe, expect, it } from 'vitest';
import { codes, messages, only, parseSource, sexpr, tree } from '../../helpers/parse.js';

describe('the condition comes first (§7.3, CHANGES C01)', () => {
  it('reads <condition> ከሆነ፦', () => {
    const statement = only('ዕድሜ > 18 ከሆነ፦\n    ጻፍ("ትልቅ")');
    expect(statement.type).toBe('IfStatement');
    if (statement.type !== 'IfStatement') return;
    expect(sexpr(statement.condition)).toBe('(GT ዕድሜ 18)');
    expect(statement.consequent.statements).toHaveLength(1);
    expect(statement.elifs).toEqual([]);
    expect(statement.alternate).toBeNull();
  });

  it('reads the original repository own example line', () => {
    const statement = only('ስም == "መልኬ" ከሆነ፦\n    ጻፍ("እናት")');
    expect(statement.type).toBe('IfStatement');
    if (statement.type !== 'IfStatement') return;
    expect(sexpr(statement.condition)).toBe('(EQ ስም "መልኬ")');
  });

  it('accepts every ከሆነ spelling', () => {
    for (const spelling of ['ከሆነ', 'ከሖነ', 'ከኆነ']) {
      expect(codes(`እውነት ${spelling}፦\n    ጻፍ(1)`)).toEqual([]);
    }
  });

  it('takes a condition of any complexity', () => {
    const statement = only('ሀ > 0 እና ለ < 10 ከሆነ፦\n    ጻፍ(1)');
    if (statement.type !== 'IfStatement') throw new Error('expected an if');
    expect(sexpr(statement.condition)).toBe('(AND (GT ሀ 0) (LT ለ 10))');
  });

  it('rejects the keyword-first shape, and says which way round it goes', () => {
    expect(codes('ከሆነ ዕድሜ > 18፦\n    ጻፍ(1)')).toEqual(['AH2001']);
    expect(messages('ከሆነ ዕድሜ > 18፦\n    ጻፍ(1)')[0]).toContain('ሁኔታው ከ"ከሆነ" በፊት');
  });
});

describe('elif and else (§7.3)', () => {
  it('reads ግን <condition> ከሆነ፦ branches', () => {
    const statement = only(
      ['ዕድሜ > 18 ከሆነ፦', '    ጻፍ("ትልቅ")', 'ግን ዕድሜ > 12 ከሆነ፦', '    ጻፍ("ታዳጊ")'].join('\n'),
    );
    expect(statement.type).toBe('IfStatement');
    if (statement.type !== 'IfStatement') return;
    expect(statement.elifs).toHaveLength(1);
    expect(sexpr(statement.elifs[0]?.condition ?? statement.condition)).toBe('(GT ዕድሜ 12)');
    expect(statement.alternate).toBeNull();
  });

  it('reads a chain of several, then አለበለዚያ', () => {
    const statement = only(
      [
        'ክፍል < 9 ከሆነ፦',
        '    ጻፍ("አንደኛ")',
        'ግን ክፍል < 11 ከሆነ፦',
        '    ጻፍ("ሁለተኛ")',
        'ግን ክፍል <= 13 ከሆነ፦',
        '    ጻፍ("ፕሪፓራቶሪ")',
        'አለበለዚያ፦',
        '    ጻፍ("ዩኒቨርሲቲ")',
      ].join('\n'),
    );
    if (statement.type !== 'IfStatement') throw new Error('expected an if');
    expect(statement.elifs).toHaveLength(2);
    expect(statement.alternate?.statements).toHaveLength(1);
  });

  it('accepts blank lines and comments between a block and ግን', () => {
    const source = ['እውነት ከሆነ፦', '    ጻፍ(1)', '', '# አስተያየት', 'አለበለዚያ፦', '    ጻፍ(2)'].join('\n');
    const statement = only(source);
    if (statement.type !== 'IfStatement') throw new Error('expected an if');
    expect(statement.alternate).not.toBeNull();
  });

  it('requires ግን to carry a condition and ከሆነ', () => {
    const source = ['እውነት ከሆነ፦', '    ጻፍ(1)', 'ግን ሃሰት፦', '    ጻፍ(2)'].join('\n');
    expect(codes(source)).toEqual(['AH2003']);
  });

  it('reports ግን with no preceding ከሆነ', () => {
    expect(codes('ጻፍ(1)\nግን እውነት ከሆነ፦\n    ጻፍ(2)')).toEqual(['AH2004']);
  });

  it('reports አለበለዚያ with no preceding ከሆነ', () => {
    expect(codes('ጻፍ(1)\nአለበለዚያ፦\n    ጻፍ(2)')).toEqual(['AH2004']);
  });

  it('does not attach a ግን indented differently from its ከሆነ', () => {
    // The branch keywords sit at the same level as the opening line (§7.3).
    const source = ['እውነት ከሆነ፦', '    ጻፍ(1)', '    ግን ሃሰት ከሆነ፦', '        ጻፍ(2)'].join('\n');
    expect(codes(source)).toEqual(['AH2004']);
  });
});

describe('loops (§7.4)', () => {
  it('reads <condition> እስከሆነ ድረስ፦', () => {
    const statement = only('ቆጣሪ < 5 እስከሆነ ድረስ፦\n    ቆጣሪ = ቆጣሪ + 1');
    expect(statement.type).toBe('WhileStatement');
    if (statement.type !== 'WhileStatement') return;
    expect(sexpr(statement.condition)).toBe('(LT ቆጣሪ 5)');
    expect(statement.body.statements).toHaveLength(1);
  });

  it('rejects the keyword-first shape', () => {
    expect(codes('እስከሆነ ድረስ ቆጣሪ < 5፦\n    ጻፍ(1)')).toEqual(['AH2001']);
    expect(messages('እስከሆነ ድረስ ቆጣሪ < 5፦\n    ጻፍ(1)')[0]).toContain('እስከሆነ ድረስ');
  });

  it('accepts a loop body of several statements', () => {
    const statement = only(['ቆጣሪ < 5 እስከሆነ ድረስ፦', '    ጻፍ(ቆጣሪ)', '    ቆጣሪ = ቆጣሪ + 1'].join('\n'));
    if (statement.type !== 'WhileStatement') throw new Error('expected a while');
    expect(statement.body.statements).toHaveLength(2);
  });
});

describe('blocks (§5.2)', () => {
  it('requires ፦', () => {
    expect(codes('እውነት ከሆነ\n    ጻፍ(1)')).toEqual(['AH2001']);
    expect(messages('እውነት ከሆነ\n    ጻፍ(1)')[0]).toContain('፦');
  });

  it('accepts the ASCII :- spelling', () => {
    expect(codes('እውነት ከሆነ:-\n    ጻፍ(1)')).toEqual([]);
  });

  it('refuses an inline body (CHANGES C06)', () => {
    expect(codes('እውነት ከሆነ፦ ጻፍ(1)')).toEqual(['AH2001']);
    expect(messages('እውነት ከሆነ፦ ጻፍ(1)')[0]).toContain('በቀጣዩ መስመር');
  });

  it('refuses an empty block', () => {
    expect(codes('እውነት ከሆነ፦\nጻፍ(1)')).toEqual(['AH2006']);
  });

  it('refuses an empty block at end of input', () => {
    expect(codes('እውነት ከሆነ፦\n')).toEqual(['AH2006']);
  });

  it('reports only the real mistake when a block’s one statement fails', () => {
    // Not also AH2006: the block is empty because the statement in it was
    // rejected, which has already been said.
    const source = ['እውነት ከሆነ፦', '    ግን ሃሰት ከሆነ፦', '        ጻፍ(1)'].join('\n');
    expect(codes(source)).toEqual(['AH2004']);
  });

  it('reports a body indented more than one level', () => {
    expect(codes('እውነት ከሆነ፦\n        ጻፍ(1)')).toEqual(['AH2015']);
  });

  it('keeps blank lines from ending a block', () => {
    const statement = only('እውነት ከሆነ፦\n    ጻፍ(1)\n\n    ጻፍ(2)');
    if (statement.type !== 'IfStatement') throw new Error('expected an if');
    expect(statement.consequent.statements).toHaveLength(2);
  });

  it('ends a block at the first line indented less deeply', () => {
    const { program } = parseSource('እውነት ከሆነ፦\n    ጻፍ(1)\nጻፍ(2)');
    expect(program.body).toHaveLength(2);
    expect(program.body.map((s) => s.type)).toEqual(['IfStatement', 'ExpressionStatement']);
  });

  it('nests to arbitrary depth', () => {
    const source = [
      'ሀ ከሆነ፦',
      '    ለ ከሆነ፦',
      '        ሐ ከሆነ፦',
      '            ጻፍ(1)',
      '        አለበለዚያ፦',
      '            ጻፍ(2)',
      '    ጻፍ(3)',
    ].join('\n');
    expect(codes(source)).toEqual([]);
    const statement = only(source);
    if (statement.type !== 'IfStatement') throw new Error('expected an if');
    expect(statement.consequent.statements).toHaveLength(2);
  });

  it('accepts a loop inside a conditional inside a function', () => {
    const source = [
      'ተግባር ሀ()፦',
      '    እውነት ከሆነ፦',
      '        ቆጣሪ < 3 እስከሆነ ድረስ፦',
      '            ተመላሽ 1',
      '    ተመላሽ 2',
    ].join('\n');
    expect(codes(source)).toEqual([]);
  });
});

describe('the printed tree shows structure the source cannot', () => {
  it('renders a conditional with its branches labelled', () => {
    const source = ['ሀ ከሆነ፦', '    ጻፍ(1)', 'ግን ለ ከሆነ፦', '    ጻፍ(2)', 'አለበለዚያ፦', '    ጻፍ(3)'].join(
      '\n',
    );
    expect(tree(source)).toContain('elif[0].condition');
    expect(tree(source)).toContain('alternate');
  });
});
