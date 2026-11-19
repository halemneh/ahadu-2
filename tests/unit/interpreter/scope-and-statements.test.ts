/** Scope, assignment, declarations, control flow (§5.3, §7.1–7.4). */

import { describe, expect, it } from 'vitest';
import { code, message, out, value } from '../../helpers/evaluate.js';

describe('lookup is by presence, not truthiness (§5.3, CHANGES C19)', () => {
  it.each([
    ['ቆጣሪ = 0', 'ቆጣሪ', '0'],
    ['ባዶ = ""', 'ባዶ', ''],
    ['ዝ = []', 'ዝ', '[]'],
    ['አልሆነም = ሃሰት', 'አልሆነም', 'ሃሰት'],
    ['ባዶ = ምንም', 'ባዶ', 'ምንም'],
  ])('%s then reading it gives %s', (declaration, name, want) => {
    // v1-py's symbol table used a falsy check, so every one of these read as
    // "undefined variable" — including the counter idiom that opens three of
    // its four shipped examples.
    expect(out(`${declaration}\nጻፍ(${name})`)).toEqual([want]);
  });

  it('reports a genuinely undefined name', () => {
    expect(code('ጻፍ(ያልተገለጸ)')).toBe('AH3001');
    expect(message('ጻፍ(ያልተገለጸ)')).toContain('ያልተገለጸ');
  });

  it('counts up from zero, the idiom v1-py could not run', () => {
    const source = ['ቆጣሪ = 0', 'ቆጣሪ < 3 እስከሆነ ድረስ፦', '    ጻፍ(ቆጣሪ)', '    ቆጣሪ = ቆጣሪ + 1'].join('\n');
    expect(out(source)).toEqual(['0', '1', '2']);
  });
});

describe('assignment binds in the current scope (§5.3)', () => {
  it('lets a function read an outer variable', () => {
    const source = ['ዓለም = 10', 'ተግባር አንብብ_ዓለም()፦', '    ተመላሽ ዓለም', '', 'ጻፍ(አንብብ_ዓለም())'].join(
      '\n',
    );
    expect(out(source)).toEqual(['10']);
  });

  it('does not let a function rebind one', () => {
    // ቆጣሪ = ቆጣሪ + 1 reads the outer one and creates a local (§7.1).
    const source = [
      'ዓለም = 10',
      'ተግባር ጨምር()፦',
      '    ዓለም = ዓለም + 1',
      '    ተመላሽ ዓለም',
      '',
      'ጻፍ(ጨምር())',
      'ጻፍ(ዓለም)',
    ].join('\n');
    expect(out(source)).toEqual(['11', '10']);
  });

  it('gives each call its own locals', () => {
    const source = [
      'ተግባር ቁጠር(ጀምር)፦',
      '    ቁ = ጀምር',
      '    ቁ = ቁ + 1',
      '    ተመላሽ ቁ',
      '',
      'ጻፍ(ቁጠር(1))',
      'ጻፍ(ቁጠር(10))',
    ].join('\n');
    expect(out(source)).toEqual(['2', '11']);
  });

  it('shares the enclosing scope with a block, which gets none', () => {
    const source = ['እውነት ከሆነ፦', '    ውስጥ = 5', '', 'ጻፍ(ውስጥ)'].join('\n');
    expect(out(source)).toEqual(['5']);
  });

  it('keeps a loop variable visible after the loop', () => {
    const source = ['ቆጣሪ = 0', 'ቆጣሪ < 3 እስከሆነ ድረስ፦', '    ቆጣሪ = ቆጣሪ + 1', '', 'ጻፍ(ቆጣሪ)'].join('\n');
    expect(out(source)).toEqual(['3']);
  });
});

describe('closures capture the declaring scope (§7.5)', () => {
  it('reads a variable from where the function was written', () => {
    const source = [
      'ተግባር ሰሪ()፦',
      '    ቁ = 7',
      '    ተግባር አንብብ()፦',
      '        ተመላሽ ቁ',
      '    ተመላሽ አንብብ',
      '',
      'ተግባር_ተመለሰ = ሰሪ()',
      'ጻፍ(ተግባር_ተመለሰ())',
    ].join('\n');
    expect(out(source)).toEqual(['7']);
  });

  it('cannot rebind what it captured, so a counter does not count (§5.3)', () => {
    // A faithful consequence of the no-rebinding rule, documented rather than
    // worked around.
    const source = [
      'ተግባር ሰሪ()፦',
      '    ቁ = 0',
      '    ተግባር ቀጣይ()፦',
      '        ተመላሽ ቁ + 1',
      '    ተመላሽ ቀጣይ',
      '',
      'ቀ = ሰሪ()',
      'ጻፍ(ቀ())',
      'ጻፍ(ቀ())',
    ].join('\n');
    expect(out(source)).toEqual(['1', '1']);
  });
});

describe('typed declarations (§7.2)', () => {
  it('pins a type for later assignments', () => {
    expect(code('ቁጥር ቆጣሪ = 0\nቆጣሪ = "ጽሁፍ"')).toBe('AH3009');
    expect(message('ቁጥር ቆጣሪ = 0\nቆጣሪ = "ጽሁፍ"')).toContain('ቁጥር');
  });

  it('accepts an assignment of the pinned type', () => {
    expect(out('ቁጥር ቆጣሪ = 0\nቆጣሪ = 5\nጻፍ(ቆጣሪ)')).toEqual(['5']);
  });

  it('checks the initializer itself', () => {
    expect(code('ቁጥር ቆጣሪ = "ሀ"')).toBe('AH3009');
    expect(code('ጽሁፍ ስም = 1')).toBe('AH3009');
    expect(code('እውነታ ሆነ = 1')).toBe('AH3009');
    expect(code('ስብስብ ዝ = 1')).toBe('AH3009');
  });

  it('accepts a matching initializer for each type', () => {
    expect(code('ቁጥር ሀ = 1')).toBeNull();
    expect(code('ጽሁፍ ሀ = "ለ"')).toBeNull();
    expect(code('እውነታ ሀ = ሃሰት')).toBeNull();
    expect(code('ስብስብ ሀ = []')).toBeNull();
  });

  it('leaves an untyped variable unconstrained', () => {
    expect(out('ሀ = 1\nሀ = "ጽሁፍ"\nጻፍ(ሀ)')).toEqual(['ጽሁፍ']);
  });

  it('survives re-execution inside a loop (§7.2)', () => {
    // Blocks create no scope, so this declaration runs on every iteration.
    // A redeclaration rule would have failed on the second one.
    const source = [
      'ቆጣሪ = 0',
      'ቆጣሪ < 3 እስከሆነ ድረስ፦',
      '    ቁጥር ውስጥ = ቆጣሪ * 2',
      '    ጻፍ(ውስጥ)',
      '    ቆጣሪ = ቆጣሪ + 1',
    ].join('\n');
    expect(out(source)).toEqual(['0', '2', '4']);
  });

  it('reports re-typing as a mismatch against the first annotation (§7.2)', () => {
    expect(code('ቁጥር ሀ = 1\nጽሁፍ ሀ = "ለ"')).toBe('AH3009');
    expect(message('ቁጥር ሀ = 1\nጽሁፍ ሀ = "ለ"')).toContain('ቁጥር');
  });

  it('allows a redeclaration of the same type', () => {
    expect(out('ቁጥር ሀ = 1\nቁጥር ሀ = 2\nጻፍ(ሀ)')).toEqual(['2']);
  });
});

describe('conditions must be እውነታ (§4.4)', () => {
  it.each(['5', '0', '"ሀ"', '""', '[]', 'ምንም'])('refuses %s as a condition', (expression) => {
    expect(code(`${expression} ከሆነ፦\n    ጻፍ(1)`)).toBe('AH3005');
  });

  it('names the type it found', () => {
    expect(message('5 ከሆነ፦\n    ጻፍ(1)')).toContain('ቁጥር');
  });

  it('refuses a non-boolean loop condition too', () => {
    expect(code('5 እስከሆነ ድረስ፦\n    ጻፍ(1)')).toBe('AH3005');
  });

  it('refuses a non-boolean ግን condition', () => {
    const source = ['ሃሰት ከሆነ፦', '    ጻፍ(1)', 'ግን 5 ከሆነ፦', '    ጻፍ(2)'].join('\n');
    expect(code(source)).toBe('AH3005');
  });
});

describe('conditionals (§7.3)', () => {
  it('takes the first branch whose condition holds', () => {
    const build = (age: number): string =>
      [
        `ዕድሜ = ${age}`,
        'ዕድሜ > 18 ከሆነ፦',
        '    ጻፍ("ትልቅ")',
        'ግን ዕድሜ > 12 ከሆነ፦',
        '    ጻፍ("ታዳጊ")',
        'አለበለዚያ፦',
        '    ጻፍ("ልጅ")',
      ].join('\n');

    expect(out(build(30))).toEqual(['ትልቅ']);
    expect(out(build(15))).toEqual(['ታዳጊ']);
    expect(out(build(5))).toEqual(['ልጅ']);
  });

  it('does nothing when no branch holds and there is no አለበለዚያ', () => {
    expect(out('ሃሰት ከሆነ፦\n    ጻፍ("አይገባም")')).toEqual([]);
  });

  it('evaluates only the branch it takes', () => {
    const source = ['እውነት ከሆነ፦', '    ጻፍ("አንድ")', 'አለበለዚያ፦', '    ጻፍ(ያልተገለጸ)'].join('\n');
    expect(out(source)).toEqual(['አንድ']);
  });

  it('stops checking conditions once one holds', () => {
    const source = ['እውነት ከሆነ፦', '    ጻፍ("አንድ")', 'ግን ያልተገለጸ ከሆነ፦', '    ጻፍ("ሁለት")'].join('\n');
    expect(out(source)).toEqual(['አንድ']);
  });

  it('nests', () => {
    const source = [
      'ሀ = 5',
      'ሀ > 0 ከሆነ፦',
      '    ሀ > 10 ከሆነ፦',
      '        ጻፍ("ትልቅ")',
      '    አለበለዚያ፦',
      '        ጻፍ("አነስተኛ")',
    ].join('\n');
    expect(out(source)).toEqual(['አነስተኛ']);
  });
});

describe('loops (§7.4)', () => {
  it('re-evaluates the condition each time round', () => {
    const source = ['ቁ = 3', 'ቁ > 0 እስከሆነ ድረስ፦', '    ጻፍ(ቁ)', '    ቁ = ቁ - 1'].join('\n');
    expect(out(source)).toEqual(['3', '2', '1']);
  });

  it('does not run a body whose condition starts false', () => {
    expect(out('ሃሰት እስከሆነ ድረስ፦\n    ጻፍ("አይገባም")')).toEqual([]);
  });

  it('ends in an Ahadu error rather than hanging (§9.2)', () => {
    expect(code('እውነት እስከሆነ ድረስ፦\n    ሀ = 1', { maxSteps: 1000 })).toBe('AH3018');
  });
});

describe('statement values (TOOLING.md §1.2)', () => {
  it('is the last statement’s value', () => {
    expect(value('1\n2\n3')).toBe('3');
  });

  it('is ምንም for an assignment or a declaration', () => {
    expect(value('ተግባር ሀ()፦\n    ተመላሽ 1')).toBeNull();
    expect(value('ክላስ ሀ፦\n    ለ = 1')).toBeNull();
  });

  it('runs several statements on one line, separated by ።', () => {
    expect(out('ሀ = 1። ለ = 2። ጻፍ(ሀ + ለ)')).toEqual(['3']);
  });
});
