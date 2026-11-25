/** Functions and classes (LANGUAGE.md §7.5–7.6). */

import { describe, expect, it } from 'vitest';
import { code, message, out, value } from '../../helpers/evaluate.js';

const lines = (...source: string[]): string => source.join('\n');

describe('calling functions (§7.5)', () => {
  it('binds arguments by position, left to right', () => {
    expect(out(lines('ተግባር ቀንስ(ሀ፣ ለ)፦', '    ተመላሽ ሀ - ለ', '', 'ጻፍ(ቀንስ(10፣ 3))'))).toEqual(['7']);
  });

  it('returns ምንም when it falls off the end', () => {
    expect(out(lines('ተግባር ዝም()፦', '    ሀ = 1', '', 'ጻፍ(ዝም())'))).toEqual(['ምንም']);
  });

  it('returns ምንም for a bare ተመላሽ (CHANGES C21)', () => {
    // v1-py crashed here: it visited a null expression.
    expect(out(lines('ተግባር ዝም()፦', '    ተመላሽ', '', 'ጻፍ(ዝም())'))).toEqual(['ምንም']);
  });

  it('reports the wrong number of arguments, with both counts', () => {
    const source = lines('ተግባር ድምር(ሀ፣ ለ)፦', '    ተመላሽ ሀ + ለ', '', 'ጻፍ(ድምር(1))');
    expect(code(source)).toBe('AH3010');
    expect(message(source)).toContain('2');
    expect(message(source)).toContain('1');
  });

  it('refuses to call something that is not callable', () => {
    expect(code('ሀ = 1\nሀ()')).toBe('AH3013');
    expect(code('"ሀ"()')).toBe('AH3013');
    expect(code('[1]()')).toBe('AH3013');
  });

  it('takes a function as a value and calls it later', () => {
    const source = lines(
      'ተግባር እጥፍ(ቁ)፦',
      '    ተመላሽ ቁ * 2',
      '',
      'ተግባር አድርግ(ተ፣ ቁ)፦',
      '    ተመላሽ ተ(ቁ)',
      '',
      'ጻፍ(አድርግ(እጥፍ፣ 21))',
    );
    expect(out(source)).toEqual(['42']);
  });
});

describe('ተመላሽ returns from anywhere (§7.5, CHANGES C17)', () => {
  it('returns from inside a conditional', () => {
    // v1-py decided once, syntactically, whether a function returned, so this
    // gave ምንም for the larger argument.
    const source = lines(
      'ተግባር ትልቁ(ሀ፣ ለ)፦',
      '    ሀ > ለ ከሆነ፦',
      '        ተመላሽ ሀ',
      '    ተመላሽ ለ',
      '',
      'ጻፍ(ትልቁ(12፣ 7))',
      'ጻፍ(ትልቁ(3፣ 7))',
    );
    expect(out(source)).toEqual(['12', '7']);
  });

  it('returns out of a loop, ending it', () => {
    const source = lines(
      'ተግባር አግኝ(ዝ፣ ፈላጊ)፦',
      '    ቆጣሪ = 0',
      '    ቆጣሪ < ርዝመት(ዝ) እስከሆነ ድረስ፦',
      '        ዝ[ቆጣሪ] == ፈላጊ ከሆነ፦',
      '            ተመላሽ ቆጣሪ',
      '        ቆጣሪ = ቆጣሪ + 1',
      '    ተመላሽ -1',
      '',
      'ጻፍ(አግኝ([5፣ 6፣ 7]፣ 6))',
      'ጻፍ(አግኝ([5፣ 6፣ 7]፣ 9))',
    );
    expect(out(source)).toEqual(['1', '-1']);
  });

  it('returns from several blocks deep', () => {
    const source = lines(
      'ተግባር ጥልቅ()፦',
      '    እውነት ከሆነ፦',
      '        እውነት ከሆነ፦',
      '            እውነት እስከሆነ ድረስ፦',
      '                ተመላሽ "ወጣ"',
      '    ተመላሽ "አልወጣም"',
      '',
      'ጻፍ(ጥልቅ())',
    );
    expect(out(source)).toEqual(['ወጣ']);
  });

  it('skips the statements after it', () => {
    const source = lines('ተግባር ሀ()፦', '    ተመላሽ 1', '    ጻፍ("አይገባም")', '', 'ጻፍ(ሀ())');
    expect(out(source)).toEqual(['1']);
  });
});

describe('recursion (§7.5)', () => {
  it('computes fibonacci', () => {
    const source = lines(
      'ተግባር ፊቦናቺ(ቁ)፦',
      '    ቁ < 2 ከሆነ፦',
      '        ተመላሽ ቁ',
      '    ተመላሽ ፊቦናቺ(ቁ - 1) + ፊቦናቺ(ቁ - 2)',
      '',
      'ጻፍ(ፊቦናቺ(10))',
    );
    expect(out(source)).toEqual(['55']);
  });

  it('computes a factorial', () => {
    const source = lines(
      'ተግባር ፋክቶሪያል(ቁ)፦',
      '    ቁ <= 1 ከሆነ፦',
      '        ተመላሽ 1',
      '    ተመላሽ ቁ * ፋክቶሪያል(ቁ - 1)',
      '',
      'ጻፍ(ፋክቶሪያል(10))',
    );
    expect(out(source)).toEqual(['3628800']);
  });

  it('ends runaway recursion in an Ahadu error, not a crash (§9.2)', () => {
    const source = lines('ተግባር ድ(ቁ)፦', '    ተመላሽ ድ(ቁ + 1)', '', 'ጻፍ(ድ(1))');
    expect(code(source)).toBe('AH3017');
    expect(message(source)).toContain('ድግግሞሹ');
  });

  it('still catches a stack overflow when the limit is set too high', () => {
    const source = lines('ተግባር ድ(ቁ)፦', '    ተመላሽ ድ(ቁ + 1)', '', 'ጻፍ(ድ(1))');
    expect(code(source, { maxDepth: 100000 })).toBe('AH3017');
  });
});

describe('classes (§7.6)', () => {
  const student = lines(
    'ክላስ ተማሪ፦',
    '    ጽሁፍ ስም = ""',
    '    ቁጥር ክፍል = 0',
    '',
    '    ፍጠር(ስም_)፦',
    '        ስም = ስም_',
    '',
    '    ተግባር ደረጃ()፦',
    '        ክፍል < 9 ከሆነ፦',
    '            ተመላሽ "አንደኛ"',
    '        ተመላሽ "ሁለተኛ"',
    '',
  );

  it('constructs with the constructor, and reads attributes back', () => {
    expect(out(`${student}አበበ = ተማሪ("ተስፋማርያም")\nጻፍ(አበበ.ስም)`)).toEqual(['ተስፋማርያም']);
  });

  it('initializes attributes to their declared defaults', () => {
    expect(out(`${student}አበበ = ተማሪ("ሀ")\nጻፍ(አበበ.ክፍል)`)).toEqual(['0']);
  });

  it('assigns an attribute in either spelling', () => {
    const source = `${student}አበበ = ተማሪ("ሀ")\nየአበበ ክፍል = 10\nጻፍ(አበበ.ክፍል)\nአበበ.ክፍል = 12\nጻፍ(የአበበ ክፍል)`;
    expect(out(source)).toEqual(['10', '12']);
  });

  it('runs a method against the object it was called on', () => {
    const source = `${student}አበበ = ተማሪ("ሀ")\nየአበበ ክፍል = 10\nጻፍ(አበበ.ደረጃ())`;
    expect(out(source)).toEqual(['ሁለተኛ']);
  });

  it('lets a method call a sibling method by bare name (§7.6)', () => {
    const source = lines(
      'ክላስ ሀ፦',
      '    ቁ = 2',
      '',
      '    ተግባር እጥፍ()፦',
      '        ተመላሽ ቁ * 2',
      '',
      '    ተግባር አራት()፦',
      '        ተመላሽ እጥፍ() * 2',
      '',
      'ጻፍ(ሀ().አራት())',
    );
    expect(out(source)).toEqual(['8']);
  });

  it('gives each object its own attributes', () => {
    const source = `${student}አንድ = ተማሪ("አንድ")\nሁለት = ተማሪ("ሁለት")\nየአንድ ክፍል = 5\nጻፍ(አንድ.ክፍል)\nጻፍ(ሁለት.ክፍል)`;
    expect(out(source)).toEqual(['5', '0']);
  });

  it('evaluates a list default afresh for each object (§7.6)', () => {
    // Evaluating defaults once at declaration would give every object the
    // same list, since lists are mutable references.
    const source = lines(
      'ክላስ ሳጥን፦',
      '    ዝርዝር = []',
      '',
      'አንድ = ሳጥን()',
      'ሁለት = ሳጥን()',
      'ጨምር(አንድ.ዝርዝር፣ 1)',
      'ጻፍ(አንድ.ዝርዝር)',
      'ጻፍ(ሁለት.ዝርዝር)',
    );
    expect(out(source)).toEqual(['[1]', '[]']);
  });

  it('checks an annotated attribute on assignment', () => {
    expect(code(`${student}አበበ = ተማሪ("ሀ")\nየአበበ ክፍል = "ጽሁፍ"`)).toBe('AH3009');
  });

  it('refuses an attribute the class never declared (§7.6)', () => {
    const source = `${student}አበበ = ተማሪ("ሀ")\nየአበበ ዕድሜ = 22`;
    expect(code(source)).toBe('AH3012');
    expect(message(source)).toContain('ዕድሜ');
    expect(message(source)).toContain('ተማሪ');
  });

  it('refuses reading a member the class never declared', () => {
    expect(code(`${student}ጻፍ(ተማሪ("ሀ").ዕድሜ)`)).toBe('AH3012');
  });

  it('refuses members on anything that is not an object', () => {
    expect(code('ሀ = 1\nጻፍ(ሀ.ለ)')).toBe('AH3014');
    expect(code('ጻፍ("ሀ".ለ)')).toBe('AH3014');
    expect(code('ጻፍ([1].ለ)')).toBe('AH3014');
    expect(code('ሀ = 1\nሀ.ለ = 2')).toBe('AH3014');
  });

  it('checks the constructor’s arity', () => {
    expect(code(`${student}አበበ = ተማሪ()`)).toBe('AH3010');
    expect(code(`${student}አበበ = ተማሪ("ሀ"፣ "ለ")`)).toBe('AH3010');
  });

  it('constructs with no arguments when there is no ፍጠር', () => {
    expect(out(lines('ክላስ ሀ፦', '    ለ = 7', '', 'ጻፍ(ሀ().ለ)'))).toEqual(['7']);
  });

  it('refuses arguments when there is no ፍጠር anywhere in the chain', () => {
    expect(code(lines('ክላስ ሀ፦', '    ለ = 1', '', 'ሀ(1)'))).toBe('AH3010');
  });

  it('returns the object from a constructor that ends with a bare ተመላሽ', () => {
    const source = lines('ክላስ ሀ፦', '    ለ = 1', '', '    ፍጠር()፦', '        ተመላሽ', '', 'ጻፍ(ሀ().ለ)');
    expect(out(source)).toEqual(['1']);
  });

  it('is a value: a class can be stored and called later', () => {
    const source = lines('ክላስ ሀ፦', '    ለ = 3', '', 'ሠሪ = ሀ', 'ጻፍ(ሠሪ().ለ)');
    expect(out(source)).toEqual(['3']);
  });
});

describe('inheritance (§7.6, CHANGES C18)', () => {
  const animals = lines(
    'ክላስ እንስሳ፦',
    '    ጽሁፍ ስም = ""',
    '',
    '    ፍጠር(ስም_)፦',
    '        ስም = ስም_',
    '',
    '    ተግባር ድምጽ()፦',
    '        ተመላሽ "..."',
    '',
    '    ተግባር አስተዋውቅ()፦',
    '        ተመላሽ ስም + " ይላል፦ " + ድምጽ()',
    '',
    'ክላስ ውሻ(እንስሳ)፦',
    '    ተግባር ድምጽ()፦',
    '        ተመላሽ "ውው!"',
    '',
  );

  it('declares a subclass at all, which v1-py crashed on', () => {
    expect(code(`${animals}ጻፍ("ok")`)).toBeNull();
  });

  it('inherits the parent’s constructor', () => {
    expect(out(`${animals}ጻፍ(ውሻ("ጆሮ").ስም)`)).toEqual(['ጆሮ']);
  });

  it('inherits the parent’s methods', () => {
    expect(out(`${animals}ጻፍ(ውሻ("ጆሮ").አስተዋውቅ())`)).toEqual(['ጆሮ ይላል፦ ውው!']);
  });

  it('dispatches dynamically: the parent’s method reaches the override', () => {
    // አስተዋውቅ is declared on እንስሳ and calls ድምጽ(), which must resolve to
    // ውሻ's version for a ውሻ instance.
    expect(out(`${animals}ጻፍ(እንስሳ("ጠቅላላ").አስተዋውቅ())`)).toEqual(['ጠቅላላ ይላል፦ ...']);
    expect(out(`${animals}ጻፍ(ውሻ("ጆሮ").አስተዋውቅ())`)).toEqual(['ጆሮ ይላል፦ ውው!']);
  });

  it('inherits attributes, and lets a subclass override a default', () => {
    const source = lines(
      'ክላስ ወላጅ፦',
      '    ሀ = 1',
      '    ለ = 2',
      '',
      'ክላስ ልጅ(ወላጅ)፦',
      '    ለ = 20',
      '    ሐ = 3',
      '',
      'ነገር = ልጅ()',
      'ጻፍ(ነገር.ሀ)',
      'ጻፍ(ነገር.ለ)',
      'ጻፍ(ነገር.ሐ)',
    );
    expect(out(source)).toEqual(['1', '20', '3']);
  });

  it('reports an unknown parent class', () => {
    expect(code('ክላስ ልጅ(የለም)፦\n    ሀ = 1')).toBe('AH3011');
    expect(message('ክላስ ልጅ(የለም)፦\n    ሀ = 1')).toContain('የለም');
  });

  it('refuses a parent that is not a class', () => {
    expect(code('የለም = 1\nክላስ ልጅ(የለም)፦\n    ሀ = 1')).toBe('AH3011');
  });

  it('inherits through more than one level', () => {
    const source = lines(
      'ክላስ ሀ፦',
      '    ቁ = 1',
      '',
      '    ተግባር አንብብ()፦',
      '        ተመላሽ ቁ',
      '',
      'ክላስ ለ(ሀ)፦',
      '    ሐ = 2',
      '',
      'ክላስ መ(ለ)፦',
      '    ሠ = 3',
      '',
      'ነገር = መ()',
      'ጻፍ(ነገር.አንብብ())',
      'ጻፍ(ነገር.ሠ)',
    );
    expect(out(source)).toEqual(['1', '3']);
  });
});

describe('a method is a value (§7.6)', () => {
  it('can be stored before being called', () => {
    const source = lines(
      'ክላስ ሀ፦',
      '    ቁ = 5',
      '',
      '    ተግባር አንብብ()፦',
      '        ተመላሽ ቁ',
      '',
      'ነገር = ሀ()',
      'ተ = ነገር.አንብብ',
      'ጻፍ(ተ())',
    );
    expect(out(source)).toEqual(['5']);
  });

  it('stays bound to the object it came from', () => {
    const source = lines(
      'ክላስ ሀ፦',
      '    ቁ = 0',
      '',
      '    ተግባር አንብብ()፦',
      '        ተመላሽ ቁ',
      '',
      'አንድ = ሀ()',
      'የአንድ ቁ = 1',
      'ሁለት = ሀ()',
      'የሁለት ቁ = 2',
      'ጻፍ(አንድ.አንብብ())',
      'ጻፍ(ሁለት.አንብብ())',
    );
    expect(out(source)).toEqual(['1', '2']);
  });

  it('is ምንም-valued when the declaration itself is the statement', () => {
    expect(value('ተግባር ሀ()፦\n    ተመላሽ 1')).toBeNull();
  });
});
