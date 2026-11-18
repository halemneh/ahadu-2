/**
 * The AST printer (TOOLING.md §1.1).
 *
 * This is user-facing output: `ahadu ast` and the playground's AST panel both
 * render through it, and it is how a learner sees the structure the parser
 * found. So every node kind gets printed at least once here.
 */

import { describe, expect, it } from 'vitest';
import { printAst } from '../../../src/parser/index.js';
import { parseSource, tree } from '../../helpers/parse.js';

/** The printed tree with the leading `Program [..]` line dropped. */
function lines(source: string): string[] {
  return tree(source).split('\n').slice(1);
}

describe('headings name the node and its scalar content', () => {
  it.each([
    ['42', 'NumberLiteral 42'],
    ['3.5', 'NumberLiteral 3.5'],
    ['፳፩', 'NumberLiteral 21'],
    ['"ሰላም"', 'StringLiteral "ሰላም"'],
    ['እውነት', 'BooleanLiteral እውነት'],
    ['ሃሰት', 'BooleanLiteral ሃሰት'],
    ['ምንም', 'NothingLiteral ምንም'],
    ['ቆጣሪ', 'Identifier ቆጣሪ'],
    ['-1', 'UnaryExpression NEG'],
    ['ተቃርኖ ሀ', 'UnaryExpression NOT'],
    ['1 + 2', 'BinaryExpression ADD'],
    ['1 % 2', 'BinaryExpression MOD'],
    ['ሀ እና ለ', 'BinaryExpression AND'],
    ['ሀ ወይም ለ', 'BinaryExpression OR'],
    ['[1]', 'ListLiteral'],
    ['[]', 'ListLiteral'],
    ['ሀ.ለ', 'MemberAccess .ለ'],
    ['የሀ ለ', 'MemberAccess .ለ (የ)'],
    ['ሀ[0]', 'IndexAccess'],
    ['ሀ[1:2]', 'SliceAccess'],
    ['ሀ()', 'CallExpression'],
    ['ቁጥር ሀ = 1', 'TypedDeclaration NUMBER ሀ'],
    ['ሀ = 1', 'AssignmentStatement'],
  ])('%s prints %s', (source, heading) => {
    expect(lines(source).join('\n')).toContain(heading);
  });

  it('prints a function with its parameter list', () => {
    expect(lines('ተግባር ሀ(ለ፣ ሐ)፦\n    ተመላሽ 1')).toContainEqual(
      expect.stringContaining('FunctionDeclaration ሀ(ለ፣ ሐ)'),
    );
  });

  it('prints a class, with its parent when it has one', () => {
    expect(tree('ክላስ ሀ፦\n    ለ = 1')).toContain('ClassDeclaration ሀ');
    expect(tree('ክላስ ሀ(ለ)፦\n    ሐ = 1')).toContain('ClassDeclaration ሀ(ለ)');
  });

  it('escapes what it quotes', () => {
    expect(tree('"ሀ\\nለ"')).toContain('StringLiteral "ሀ\\nለ"');
    expect(tree('"ሀ\\"ለ"')).toContain('StringLiteral "ሀ\\"ለ"');
    expect(tree('"ሀ\\\\ለ"')).toContain('StringLiteral "ሀ\\\\ለ"');
  });

  it('prints a placeholder for an expression it could not read', () => {
    expect(tree('ሀ = ')).toContain('InvalidExpression');
  });
});

describe('children are labelled by the field they fill', () => {
  it('labels an assignment', () => {
    const printed = tree('ሀ = 1');
    expect(printed).toContain('target: Identifier ሀ');
    expect(printed).toContain('value: NumberLiteral 1');
  });

  it('labels a binary expression', () => {
    const printed = tree('1 + 2');
    expect(printed).toContain('left: NumberLiteral 1');
    expect(printed).toContain('right: NumberLiteral 2');
  });

  it('labels a call', () => {
    const printed = tree('ጻፍ(1፣ 2)');
    expect(printed).toContain('callee: Identifier ጻፍ');
    expect(printed).toContain('args:');
  });

  it('labels an index and a slice', () => {
    expect(tree('ሀ[0]')).toContain('index: NumberLiteral 0');
    const slice = tree('ሀ[1:2]');
    expect(slice).toContain('from: NumberLiteral 1');
    expect(slice).toContain('to: NumberLiteral 2');
  });

  it('omits the ends of an open slice', () => {
    const printed = tree('ሀ[:]');
    expect(printed).toContain('SliceAccess');
    expect(printed).not.toContain('from:');
    expect(printed).not.toContain('to:');
  });

  it('omits an absent return value', () => {
    const printed = tree('ተግባር ሀ()፦\n    ተመላሽ');
    expect(printed).toContain('ReturnStatement');
    expect(printed).not.toContain('value:');
  });

  it('labels every branch of a conditional', () => {
    const printed = tree(
      ['ሀ ከሆነ፦', '    ጻፍ(1)', 'ግን ለ ከሆነ፦', '    ጻፍ(2)', 'አለበለዚያ፦', '    ጻፍ(3)'].join('\n'),
    );
    expect(printed).toContain('condition:');
    expect(printed).toContain('consequent: Block');
    expect(printed).toContain('elif[0].condition:');
    expect(printed).toContain('elif[0].body: Block');
    expect(printed).toContain('alternate: Block');
  });

  it('labels a loop', () => {
    const printed = tree('ሀ እስከሆነ ድረስ፦\n    ጻፍ(1)');
    expect(printed).toContain('condition: Identifier ሀ');
    expect(printed).toContain('body: Block');
  });

  it('separates a class body into its three kinds of member', () => {
    const printed = tree(
      [
        'ክላስ ሀ፦',
        '    ለ = 1',
        '    ፍጠር()፦',
        '        ለ = 2',
        '    ተግባር ሐ()፦',
        '        ተመላሽ 1',
      ].join('\n'),
    );
    expect(printed).toContain('attributes:');
    expect(printed).toContain('AttributeDeclaration');
    expect(printed).toContain('constructor: ConstructorDeclaration');
    expect(printed).toContain('methods:');
  });

  it('omits class sections that are empty', () => {
    const printed = tree('ክላስ ሀ፦\n    ለ = 1');
    expect(printed).toContain('attributes:');
    expect(printed).not.toContain('constructor:');
    expect(printed).not.toContain('methods:');
  });
});

describe('shape', () => {
  it('uses box-drawing branches, with └─ on the last child', () => {
    const printed = tree('ጻፍ(1፣ 2)');
    expect(printed).toContain('├─');
    expect(printed).toContain('└─');
  });

  it('carries a line:col-line:col span on every node', () => {
    for (const line of lines('ተግባር ሀ()፦\n    ተመላሽ 1')) {
      if (line.trim().endsWith(':')) continue; // a group header has no node
      expect(line).toMatch(/\[\d+:\d+-\d+:\d+\]$/);
    }
  });

  it('spans a multi-line construct across the lines it covers', () => {
    expect(tree('ተግባር ሀ()፦\n    ተመላሽ 1')).toContain('FunctionDeclaration ሀ() [1:1-2:10]');
  });

  it('prints a single node on its own', () => {
    const { program } = parseSource('1 + 2');
    const statement = program.body[0];
    if (statement?.type !== 'ExpressionStatement') throw new Error('expected an expression');
    expect(printAst(statement.expression)).toMatch(/^BinaryExpression ADD \[/);
  });

  it('prints an empty program as one line', () => {
    expect(tree('').split('\n')).toHaveLength(1);
  });
});
