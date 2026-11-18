/** Shared helpers for parser tests. */

import { tokenize } from '../../src/lexer/index.js';
import { parse, printAst } from '../../src/parser/index.js';
import type { Expression, Node, Program, Statement } from '../../src/parser/index.js';
import type { Diagnostic } from '../../src/diagnostics.js';

export interface Parsed {
  program: Program;
  /** Parser diagnostics only. */
  diagnostics: readonly Diagnostic[];
  /** Lexer diagnostics, which most parser tests expect to be empty. */
  lexDiagnostics: readonly Diagnostic[];
}

export function parseSource(source: string): Parsed {
  const lexed = tokenize(source);
  const { program, diagnostics } = parse(lexed.tokens);
  return { program, diagnostics, lexDiagnostics: lexed.diagnostics };
}

/** The program's statements, asserting nothing went wrong on the way. */
export function statements(source: string): readonly Statement[] {
  const { program, diagnostics, lexDiagnostics } = parseSource(source);
  if (lexDiagnostics.length > 0) {
    throw new Error(`unexpected lexer diagnostics: ${lexDiagnostics.map((d) => d.code).join()}`);
  }
  if (diagnostics.length > 0) {
    throw new Error(
      `unexpected parser diagnostics: ${diagnostics.map((d) => `${d.code} ${d.message}`).join(' | ')}`,
    );
  }
  return program.body;
}

/** The single statement a source is expected to produce. */
export function only(source: string): Statement {
  const body = statements(source);
  if (body.length !== 1) throw new Error(`expected 1 statement, got ${body.length}`);
  return body[0] as Statement;
}

/** The expression of a source that is one expression statement. */
export function expression(source: string): Expression {
  const statement = only(source);
  if (statement.type !== 'ExpressionStatement') {
    throw new Error(`expected an expression statement, got ${statement.type}`);
  }
  return statement.expression;
}

/** Parser diagnostic codes, in source order. */
export function codes(source: string): string[] {
  return parseSource(source).diagnostics.map((d) => d.code);
}

/** Parser diagnostic messages, in source order. */
export function messages(source: string): string[] {
  return parseSource(source).diagnostics.map((d) => d.message);
}

export function tree(source: string): string {
  return printAst(parseSource(source).program);
}

export function outline(node: Node): string[] {
  return printAst(node).split('\n');
}

/**
 * Renders an expression as a prefix s-expression — `(ADD 1 (MUL 2 3))`.
 *
 * Precedence and associativity are exactly what this makes legible, and
 * nothing else about the tree gets in the way.
 */
export function sexpr(node: Expression): string {
  switch (node.type) {
    case 'NumberLiteral':
      return String(node.value);
    case 'StringLiteral':
      return JSON.stringify(node.value);
    case 'BooleanLiteral':
      return node.value ? 'እውነት' : 'ሃሰት';
    case 'NothingLiteral':
      return 'ምንም';
    case 'Identifier':
      return node.name;
    case 'BinaryExpression':
      return `(${node.operator} ${sexpr(node.left)} ${sexpr(node.right)})`;
    case 'UnaryExpression':
      return `(${node.operator} ${sexpr(node.operand)})`;
    case 'ListLiteral':
      return `[${node.elements.map(sexpr).join(' ')}]`;
    case 'MemberAccess':
      return `(${node.spelling === 'of' ? 'OF' : 'DOT'} ${sexpr(node.object)} ${node.property})`;
    case 'IndexAccess':
      return `(AT ${sexpr(node.target)} ${sexpr(node.index)})`;
    case 'SliceAccess':
      return `(SLICE ${sexpr(node.target)} ${node.from === null ? '_' : sexpr(node.from)} ${
        node.to === null ? '_' : sexpr(node.to)
      })`;
    case 'CallExpression':
      return `(CALL ${sexpr(node.callee)}${node.args.length > 0 ? ' ' : ''}${node.args
        .map(sexpr)
        .join(' ')})`;
    case 'InvalidExpression':
      return '<invalid>';
  }
}

/** The s-expression for a source that is one expression statement. */
export function sx(source: string): string {
  return sexpr(expression(source));
}
