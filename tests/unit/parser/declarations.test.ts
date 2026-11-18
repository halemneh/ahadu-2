/** Function and class declarations (LANGUAGE.md §7.5–7.6). */

import { describe, expect, it } from 'vitest';
import { codes, messages, only, sexpr } from '../../helpers/parse.js';

describe('functions (§7.5)', () => {
  it('reads a name, parameters and a block body', () => {
    const fn = only('ተግባር ሰላም_በል(ስም)፦\n    ጻፍ("ሰላም " + ስም)');
    expect(fn).toMatchObject({
      type: 'FunctionDeclaration',
      name: 'ሰላም_በል',
      params: ['ስም'],
    });
  });

  it('reads several parameters, Ethiopic or ASCII comma', () => {
    expect(only('ተግባር ሀ(ሰ፣ ለ፣ ሐ)፦\n    ተመላሽ 1')).toMatchObject({ params: ['ሰ', 'ለ', 'ሐ'] });
    expect(only('ተግባር ሀ(ሰ, ለ)፦\n    ተመላሽ 1')).toMatchObject({ params: ['ሰ', 'ለ'] });
  });

  it('reads no parameters', () => {
    expect(only('ተግባር ሀ()፦\n    ተመላሽ 1')).toMatchObject({ params: [] });
  });

  it('reports a duplicate parameter name', () => {
    expect(codes('ተግባር ሀ(ሰ፣ ሰ)፦\n    ተመላሽ 1')).toEqual(['AH2012']);
  });

  it('refuses a trailing comma in the parameter list', () => {
    expect(codes('ተግባር ሀ(ሰ፣)፦\n    ተመላሽ 1')).toEqual(['AH2001']);
  });

  it('requires a name', () => {
    expect(codes('ተግባር ()፦\n    ተመላሽ 1')).toEqual(['AH2001']);
    expect(messages('ተግባር ()፦\n    ተመላሽ 1')[0]).toContain('የተግባር ስም');
  });

  it('requires a parameter list', () => {
    expect(codes('ተግባር ሀ፦\n    ተመላሽ 1')).toEqual(['AH2001']);
  });

  it('accepts a nested function declaration', () => {
    const outer = only(
      ['ተግባር ውጪ()፦', '    ተግባር ውስጥ()፦', '        ተመላሽ 1', '    ተመላሽ ውስጥ'].join('\n'),
    );
    if (outer.type !== 'FunctionDeclaration') throw new Error('expected a function');
    expect(outer.body.statements[0]?.type).toBe('FunctionDeclaration');
  });

  it('accepts recursion', () => {
    expect(
      codes(
        ['ተግባር ፊቦናቺ(ቁ)፦', '    ቁ < 2 ከሆነ፦', '        ተመላሽ ቁ', '    ተመላሽ ፊቦናቺ(ቁ - 1)'].join('\n'),
      ),
    ).toEqual([]);
  });
});

describe('classes (§7.6)', () => {
  const student = [
    'ክላስ ተማሪ፦',
    '    ጽሁፍ ስም = ""',
    '    ቁጥር ክፍል = 0',
    '',
    '    ፍጠር(ስም_)፦',
    '        ስም = ስም_',
    '',
    '    ተግባር ደረጃ()፦',
    '        ተመላሽ "አንደኛ"',
  ].join('\n');

  it('separates attributes, constructor and methods (CHANGES C03)', () => {
    const declaration = only(student);
    expect(declaration.type).toBe('ClassDeclaration');
    if (declaration.type !== 'ClassDeclaration') return;

    expect(declaration.name).toBe('ተማሪ');
    expect(declaration.parent).toBeNull();
    expect(declaration.attributes.map((a) => a.name)).toEqual(['ስም', 'ክፍል']);
    expect(declaration.attributes.map((a) => a.declaredType)).toEqual(['STRING', 'NUMBER']);
    expect(declaration.constructor).toMatchObject({ params: ['ስም_'] });
    expect(declaration.methods.map((m) => m.name)).toEqual(['ደረጃ']);
  });

  it('reads untyped attributes', () => {
    const declaration = only('ክላስ ሀ፦\n    ለ = 1');
    if (declaration.type !== 'ClassDeclaration') throw new Error('expected a class');
    expect(declaration.attributes[0]).toMatchObject({ name: 'ለ', declaredType: null });
  });

  it('reads a parent class', () => {
    const declaration = only('ክላስ ውሻ(እንስሳ)፦\n    ተግባር ድምጽ()፦\n        ተመላሽ "ውው"');
    if (declaration.type !== 'ClassDeclaration') throw new Error('expected a class');
    expect(declaration.parent).toBe('እንስሳ');
  });

  it('requires a parent name inside the parentheses', () => {
    expect(codes('ክላስ ውሻ()፦\n    ለ = 1')).toEqual(['AH2001']);
  });

  it('requires a class name', () => {
    expect(codes('ክላስ ፦\n    ለ = 1')).toEqual(['AH2001']);
  });

  it('requires every attribute to have a default value', () => {
    expect(codes('ክላስ ሀ፦\n    ለ')).toEqual(['AH2013']);
    expect(messages('ክላስ ሀ፦\n    ለ')[0]).toContain('ነባሪ ዋጋ');
  });

  it('refuses a class member that is not even a name', () => {
    expect(codes('ክላስ ሀ፦\n    1 = 2')).toEqual(['AH2013']);
    expect(codes('ክላስ ሀ፦\n    "ጽሁፍ"')).toEqual(['AH2013']);
  });

  it('refuses anything else in the body', () => {
    expect(codes('ክላስ ሀ፦\n    እውነት ከሆነ፦\n        ጻፍ(1)')).toEqual(['AH2013']);
    expect(codes('ክላስ ሀ፦\n    ጻፍ(1)')).toEqual(['AH2013']);
  });

  it('allows at most one constructor', () => {
    const source = ['ክላስ ሀ፦', '    ፍጠር()፦', '        ለ = 1', '    ፍጠር(ሐ)፦', '        ለ = ሐ'].join(
      '\n',
    );
    expect(codes(source)).toEqual(['AH2013']);
    expect(messages(source)[0]).toContain('አንድ ጊዜ ብቻ');
  });

  it('refuses a value-returning ፍጠር', () => {
    expect(codes('ክላስ ሀ፦\n    ፍጠር()፦\n        ተመላሽ 1')).toEqual(['AH2014']);
  });

  it('accepts a bare ተመላሽ in ፍጠር', () => {
    expect(codes('ክላስ ሀ፦\n    ፍጠር()፦\n        ተመላሽ')).toEqual([]);
  });

  it('allows a method inside the constructor body to return a value', () => {
    // The AH2014 restriction belongs to ፍጠር itself, not to anything nested
    // inside it (§7.6).
    const source = [
      'ክላስ ሀ፦',
      '    ፍጠር()፦',
      '        ተግባር ውስጥ()፦',
      '            ተመላሽ 1',
      '        ለ = ውስጥ()',
      '    ለ = 0',
    ].join('\n');
    expect(codes(source)).toEqual([]);
  });

  it('refuses ፍጠር outside a class', () => {
    expect(codes('ፍጠር()፦\n    ሀ = 1')).toEqual(['AH2001']);
    expect(messages('ፍጠር()፦\n    ሀ = 1')[0]).toContain('በክላስ ውስጥ');
  });

  it('reports an empty class body', () => {
    expect(codes('ክላስ ሀ፦\nጻፍ(1)')).toEqual(['AH2006']);
  });

  it('reads attribute defaults as full expressions', () => {
    const declaration = only('ክላስ ሀ፦\n    ለ = 1 + 2 * 3');
    if (declaration.type !== 'ClassDeclaration') throw new Error('expected a class');
    expect(sexpr(declaration.attributes[0]?.value ?? ({ type: 'NothingLiteral' } as never))).toBe(
      '(ADD 1 (MUL 2 3))',
    );
  });

  it('accepts the whole inheritance example from the corpus', () => {
    const source = [
      'ክላስ እንስሳ፦',
      '    ጽሁፍ ስም = ""',
      '',
      '    ፍጠር(ስም_)፦',
      '        ስም = ስም_',
      '',
      '    ተግባር ድምጽ()፦',
      '        ተመላሽ "..."',
      '',
      'ክላስ ውሻ(እንስሳ)፦',
      '    ተግባር ድምጽ()፦',
      '        ተመላሽ "ውው!"',
      '',
      'ጻፍ(ውሻ("ጆሮ").ድምጽ())',
    ].join('\n');
    expect(codes(source)).toEqual([]);
  });
});
