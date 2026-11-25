/**
 * Renders an AST as an indented tree (TOOLING.md §1.1).
 *
 * This is what `ahadu ast` prints and what the playground's AST panel shows.
 * It exists so a learner can see the structure the parser found — especially
 * precedence, which is invisible in the source and obvious in the tree.
 */

import type { Expression, Node, Span, Statement } from './ast.js';
import { formatSpan } from './ast.js';

/** One child, or a list of them, labelled by the field it fills. */
type Child = [label: string | null, value: Node | readonly Node[]];

function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** The node's own one-line heading: its kind, then anything scalar it holds. */
function heading(node: Node): string {
  switch (node.type) {
    case 'NumberLiteral':
      return `NumberLiteral ${node.value}`;
    case 'StringLiteral':
      return `StringLiteral ${quote(node.value)}`;
    case 'BooleanLiteral':
      return `BooleanLiteral ${node.value ? 'እውነት' : 'ሃሰት'}`;
    case 'NothingLiteral':
      return 'NothingLiteral ምንም';
    case 'Identifier':
      return `Identifier ${node.name}`;
    case 'MemberAccess':
      return `MemberAccess .${node.property}${node.spelling === 'of' ? ' (የ)' : ''}`;
    case 'UnaryExpression':
      return `UnaryExpression ${node.operator}`;
    case 'BinaryExpression':
      return `BinaryExpression ${node.operator}`;
    case 'TypedDeclaration':
      return `TypedDeclaration ${node.declaredType} ${node.name}`;
    case 'FunctionDeclaration':
      return `FunctionDeclaration ${node.name}(${node.params.join('፣ ')})`;
    case 'ClassDeclaration':
      return `ClassDeclaration ${node.name}${node.parent === null ? '' : `(${node.parent})`}`;
    case 'ForEachStatement':
      return `ForEachStatement ${node.name}`;
    default:
      return node.type;
  }
}

/** The node's children, in source order, each labelled by the field it fills. */
function children(node: Node): Child[] {
  switch (node.type) {
    case 'Program':
      return [['body', node.body]];
    case 'Block':
      return [[null, node.statements]];

    // ---- statements ----
    case 'ExpressionStatement':
      return [[null, node.expression]];
    case 'AssignmentStatement':
      return [
        ['target', node.target],
        ['value', node.value],
      ];
    case 'TypedDeclaration':
      return [['value', node.value]];
    case 'ReturnStatement':
      return node.value === null ? [] : [['value', node.value]];
    case 'IfStatement': {
      const out: Child[] = [
        ['condition', node.condition],
        ['consequent', node.consequent],
      ];
      node.elifs.forEach((branch, i) => {
        out.push([`elif[${i}].condition`, branch.condition]);
        out.push([`elif[${i}].body`, branch.body]);
      });
      if (node.alternate !== null) out.push(['alternate', node.alternate]);
      return out;
    }
    case 'WhileStatement':
      return [
        ['condition', node.condition],
        ['body', node.body],
      ];
    case 'ForEachStatement':
      return [
        ['collection', node.collection],
        ['body', node.body],
      ];
    case 'FunctionDeclaration':
      return [['body', node.body]];
    case 'ClassDeclaration': {
      const out: Child[] = [];
      if (node.attributes.length > 0) out.push(['attributes', node.attributes]);
      if (node.constructor !== null) out.push(['constructor', node.constructor]);
      if (node.methods.length > 0) out.push(['methods', node.methods]);
      return out;
    }

    // ---- class members ----
    case 'AttributeDeclaration':
      return [['value', node.value]];
    case 'ConstructorDeclaration':
      return [['body', node.body]];

    // ---- expressions ----
    case 'ListLiteral':
      return node.elements.length === 0 ? [] : [['elements', node.elements]];
    case 'MemberAccess':
      return [['object', node.object]];
    case 'IndexAccess':
      return [
        ['target', node.target],
        ['index', node.index],
      ];
    case 'SliceAccess': {
      const out: Child[] = [['target', node.target]];
      if (node.from !== null) out.push(['from', node.from]);
      if (node.to !== null) out.push(['to', node.to]);
      return out;
    }
    case 'CallExpression': {
      const out: Child[] = [['callee', node.callee]];
      if (node.args.length > 0) out.push(['args', node.args]);
      return out;
    }
    case 'UnaryExpression':
      return [[null, node.operand]];
    case 'BinaryExpression':
      return [
        ['left', node.left],
        ['right', node.right],
      ];

    default:
      return [];
  }
}

function isNodeList(value: Node | readonly Node[]): value is readonly Node[] {
  return Array.isArray(value);
}

/**
 * One line of a rendered tree.
 *
 * `span` is null for a group header such as `args:`, which labels a list
 * rather than standing for a node of its own. The playground's AST panel uses
 * these to highlight the source a row covers, which is why the walk produces
 * structure and the text is derived from it rather than the other way round.
 */
export interface AstRow {
  /** The full line, prefix and heading included. */
  readonly text: string;
  /** How deep in the tree the row sits. */
  readonly depth: number;
  /** The node the row stands for, or null for a group header. */
  readonly span: Span | null;
}

function row(prefix: string, last: boolean, label: string, node: Node, depth: number): AstRow {
  return {
    text: `${prefix}${last ? '└─ ' : '├─ '}${label}${heading(node)} [${formatSpan(node)}]`,
    depth,
    span: node,
  };
}

function walk(node: Node, prefix: string, depth: number, rows: AstRow[]): void {
  // An empty list contributes nothing, so it should not leave a label behind
  // with no children under it.
  const kids = children(node).filter(([, value]) => !isNodeList(value) || value.length > 0);

  kids.forEach(([label, value], index) => {
    const last = index === kids.length - 1;
    const deeper = prefix + (last ? '   ' : '│  ');

    if (!isNodeList(value)) {
      rows.push(row(prefix, last, label === null ? '' : `${label}: `, value, depth));
      walk(value, deeper, depth + 1, rows);
      return;
    }

    // An unlabelled list — a block's statements — hangs directly off the
    // parent; a labelled one gets a header line of its own.
    const base = label === null ? prefix : deeper;
    if (label !== null) {
      rows.push({
        text: `${prefix}${last ? '└─ ' : '├─ '}${label}:`,
        depth,
        span: null,
      });
    }

    value.forEach((child, i) => {
      const lastChild = i === value.length - 1;
      rows.push(row(base, lastChild, '', child, label === null ? depth : depth + 1));
      walk(child, base + (lastChild ? '   ' : '│  '), label === null ? depth + 1 : depth + 2, rows);
    });
  });
}

/**
 * Walks a node into one row per line.
 *
 * Statements and expressions appear with the field name they fill, so the
 * tree reads as the grammar rather than as an anonymous nest of boxes.
 */
export function outlineAst(node: Node): AstRow[] {
  const rows: AstRow[] = [{ text: `${heading(node)} [${formatSpan(node)}]`, depth: 0, span: node }];
  walk(node, '', 1, rows);
  return rows;
}

/** The rendered tree as text, which is what `ahadu ast` prints. */
export function printAst(node: Node): string {
  return outlineAst(node)
    .map((r) => r.text)
    .join('\n');
}

export type { Expression, Span, Statement };
