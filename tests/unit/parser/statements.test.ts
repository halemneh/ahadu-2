/** Assignment, typed declarations, return, statement terminators (§5.1, §7.1–7.2, §7.5). */

import { describe, expect, it } from 'vitest';
import { codes, messages, only, parseSource, statements } from '../../helpers/parse.js';

describe('assignment (§7.1)', () => {
  it('assigns to a name', () => {
    expect(only('ስም = "ሰላም"')).toMatchObject({
      type: 'AssignmentStatement',
      target: { type: 'Identifier', name: 'ስም' },
      value: { type: 'StringLiteral', value: 'ሰላም' },
    });
  });

  it('assigns to a list index', () => {
    expect(only('ዝ[0] = 9')).toMatchObject({
      type: 'AssignmentStatement',
      target: { type: 'IndexAccess' },
    });
  });

  it('assigns to an attribute, dot form', () => {
    expect(only('ሃይሌ.ዕድሜ = 22')).toMatchObject({
      type: 'AssignmentStatement',
      target: { type: 'MemberAccess', property: 'ዕድሜ', spelling: 'dot' },
    });
  });

  it('assigns to an attribute, የ form', () => {
    expect(only('የሃይሌ ዕድሜ = 22')).toMatchObject({
      type: 'AssignmentStatement',
      target: {
        type: 'MemberAccess',
        object: { type: 'Identifier', name: 'ሃይሌ' },
        property: 'ዕድሜ',
        spelling: 'of',
      },
    });
  });

  it('evaluates nothing itself — it is a statement, not an expression', () => {
    // ሀ = ለ = 1 would need assignment to be an expression (CHANGES C12).
    expect(codes('ሀ = ለ = 1')).toEqual(['AH2001']);
    expect(messages('ሀ = ለ = 1')[0]).toContain('ሰንሰለት ምደባ');
  });

  it('refuses a condition built from an assignment', () => {
    expect(codes('ሀ = 1 ከሆነ፦\n    ጻፍ(1)')).not.toEqual([]);
  });

  it.each([
    ['ጻፍ("ሰላም") = 1', 'a call'],
    ['1 = 2', 'a literal'],
    ['(ሀ) = 1', 'a parenthesized name'],
    ['ሀ + ለ = 1', 'an arithmetic expression'],
  ])('reports AH2011 for %s (%s)', (source) => {
    expect(codes(source)).toEqual(['AH2011']);
  });

  it('reports AH2009 for a slice target', () => {
    expect(codes('ዝ[0:2] = [9፣ 9]')).toEqual(['AH2009']);
    expect(messages('ዝ[0:2] = [9፣ 9]')[0]).toContain('አዋህድ');
  });
});

describe('typed declarations (§7.2)', () => {
  it.each([
    ['ቁጥር ቆጣሪ = 0', 'NUMBER'],
    ['ጽሁፍ ስም = "ሰላም"', 'STRING'],
    ['ፅሁፍ ስም = "ሰላም"', 'STRING'],
    ['እውነታ ተጠናቋል = ሃሰት', 'BOOLEAN'],
    ['ስብስብ ቤተሰብ = []', 'LIST'],
  ])('%s declares a %s', (source, declaredType) => {
    expect(only(source)).toMatchObject({ type: 'TypedDeclaration', declaredType });
  });

  it('requires an initializer', () => {
    expect(codes('ቁጥር ቆጣሪ')).toEqual(['AH2007']);
    expect(messages('ቁጥር ቆጣሪ')[0]).toContain('ቁጥር ቆጣሪ = 0');
  });

  it('requires a name', () => {
    expect(codes('ቁጥር = 0')).toEqual(['AH2001']);
  });

  it('leaves ፊደል reserved rather than a type (§4.3, CHANGES C08)', () => {
    expect(codes('ፊደል ፊት = "ሀ"')).toEqual(['AH2010']);
  });
});

describe('return (§7.5)', () => {
  it('carries a value', () => {
    const fn = only('ተግባር ሀ()፦\n    ተመላሽ 1');
    expect(fn).toMatchObject({
      type: 'FunctionDeclaration',
      body: { statements: [{ type: 'ReturnStatement', value: { type: 'NumberLiteral' } }] },
    });
  });

  it('may carry nothing', () => {
    const fn = only('ተግባር ሀ()፦\n    ተመላሽ');
    expect(fn).toMatchObject({
      type: 'FunctionDeclaration',
      body: { statements: [{ type: 'ReturnStatement', value: null }] },
    });
  });

  it('is legal anywhere inside a function, not only last (CHANGES C17)', () => {
    const fn = only('ተግባር ትልቁ(ሀ፣ ለ)፦\n    ሀ > ለ ከሆነ፦\n        ተመላሽ ሀ\n    ተመላሽ ለ');
    expect(fn).toMatchObject({ type: 'FunctionDeclaration' });
    if (fn.type !== 'FunctionDeclaration') return;
    expect(fn.body.statements).toHaveLength(2);
    expect(fn.body.statements[0]?.type).toBe('IfStatement');
    expect(fn.body.statements[1]?.type).toBe('ReturnStatement');
  });

  it('reports AH2005 outside any function', () => {
    expect(codes('ተመላሽ 5')).toEqual(['AH2005']);
  });

  it('reports AH2005 inside a bare block', () => {
    expect(codes('እውነት ከሆነ፦\n    ተመላሽ 5')).toEqual(['AH2005']);
  });
});

describe('statement terminators (§5.1)', () => {
  it('ends a statement at a newline', () => {
    expect(statements('ሀ = 1\nለ = 2')).toHaveLength(2);
  });

  it('ends a statement at ።, allowing another on the same line', () => {
    const body = statements('ሀ = 1። ለ = 2');
    expect(body).toHaveLength(2);
    expect(body.map((s) => s.type)).toEqual(['AssignmentStatement', 'AssignmentStatement']);
  });

  it('accepts a trailing ።', () => {
    expect(statements('ሀ = 1።')).toHaveLength(1);
  });

  it('accepts several ። on one line', () => {
    expect(statements('ሀ = 1። ለ = 2። ሐ = 3')).toHaveLength(3);
  });

  it('ends a statement at end of input', () => {
    expect(statements('ሀ = 1')).toHaveLength(1);
  });

  it('skips blank lines between statements', () => {
    expect(statements('ሀ = 1\n\n\nለ = 2')).toHaveLength(2);
  });

  it('skips comment-only lines', () => {
    expect(statements('ሀ = 1\n# አስተያየት\nለ = 2')).toHaveLength(2);
  });

  it('reports leftovers after a statement', () => {
    expect(codes('ሀ = 1 2')).toEqual(['AH2001']);
  });
});

describe('expression statements', () => {
  it('wraps a call', () => {
    expect(only('ጻፍ("ሰላም")')).toMatchObject({
      type: 'ExpressionStatement',
      expression: { type: 'CallExpression' },
    });
  });

  it('wraps a bare value, which the REPL prints', () => {
    expect(only('1 + 2')).toMatchObject({ type: 'ExpressionStatement' });
  });
});

describe('program node', () => {
  it('spans from the first statement to the last', () => {
    const { program } = parseSource('ሀ = 1\nለ = 2');
    expect(program).toMatchObject({ line: 1, startCol: 1, endLine: 2, endCol: 5 });
  });

  it('is empty for an empty source', () => {
    expect(parseSource('').program.body).toEqual([]);
  });

  it('is empty for a comment-only source', () => {
    expect(parseSource('# ምንም የለም\n').program.body).toEqual([]);
  });
});
