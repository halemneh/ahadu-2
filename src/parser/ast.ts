/**
 * The AST (LANGUAGE.md §5–7, GRAMMAR.ebnf).
 *
 * Nodes are plain data in discriminated unions, so the evaluator switches on
 * `type` and the compiler checks the switch is exhaustive.
 *
 * Every node carries a four-component span. A statement can cover many lines
 * — a class declaration covers its whole body — so a single `line` with two
 * columns would be a lie. Diagnostics stay single-line (§9.1) because a caret
 * belongs under one line; node spans do not.
 */

export interface Span {
  readonly line: number;
  readonly startCol: number;
  readonly endLine: number;
  readonly endCol: number;
}

// ---------------------------------------------------------------------------
// Expressions (§6)
// ---------------------------------------------------------------------------

export interface NumberLiteral extends Span {
  readonly type: 'NumberLiteral';
  readonly value: number;
}

export interface StringLiteral extends Span {
  readonly type: 'StringLiteral';
  readonly value: string;
}

export interface BooleanLiteral extends Span {
  readonly type: 'BooleanLiteral';
  readonly value: boolean;
}

/** `ምንም` — the no-value (§4.6). */
export interface NothingLiteral extends Span {
  readonly type: 'NothingLiteral';
}

export interface ListLiteral extends Span {
  readonly type: 'ListLiteral';
  readonly elements: readonly Expression[];
}

export interface Identifier extends Span {
  readonly type: 'Identifier';
  readonly name: string;
}

/**
 * `obj.attr` or `የobj attr` — the same thing said two ways (§6.4).
 *
 * `spelling` is kept so `ahadu fmt` and the AST view can show the source
 * form; nothing about evaluation depends on it.
 */
export interface MemberAccess extends Span {
  readonly type: 'MemberAccess';
  readonly object: Expression;
  readonly property: string;
  readonly spelling: 'dot' | 'of';
}

export interface IndexAccess extends Span {
  readonly type: 'IndexAccess';
  readonly target: Expression;
  readonly index: Expression;
}

/** `x[a:b]`, either end omittable (§6.5). */
export interface SliceAccess extends Span {
  readonly type: 'SliceAccess';
  readonly target: Expression;
  readonly from: Expression | null;
  readonly to: Expression | null;
}

export interface CallExpression extends Span {
  readonly type: 'CallExpression';
  readonly callee: Expression;
  readonly args: readonly Expression[];
}

export type UnaryOperator = 'NEG' | 'NOT';

export interface UnaryExpression extends Span {
  readonly type: 'UnaryExpression';
  readonly operator: UnaryOperator;
  readonly operand: Expression;
}

export type BinaryOperator =
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'MOD'
  | 'POW'
  | 'EQ'
  | 'NEQ'
  | 'LT'
  | 'LTE'
  | 'GT'
  | 'GTE'
  /** `እና` / `&` — short-circuits (§6.2). */
  | 'AND'
  /** `ወይም` / `|` — short-circuits (§6.2). */
  | 'OR';

export interface BinaryExpression extends Span {
  readonly type: 'BinaryExpression';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
}

/**
 * Stands in where an expression could not be parsed, so the tree is still
 * shaped like the source and an editor can keep working (§9.3). An evaluator
 * never sees one: diagnostics stop the program before it runs.
 */
export interface InvalidExpression extends Span {
  readonly type: 'InvalidExpression';
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NothingLiteral
  | ListLiteral
  | Identifier
  | MemberAccess
  | IndexAccess
  | SliceAccess
  | CallExpression
  | UnaryExpression
  | BinaryExpression
  | InvalidExpression;

/** What may appear to the left of `=` (§7.1). */
export type AssignTarget = Identifier | MemberAccess | IndexAccess;

// ---------------------------------------------------------------------------
// Statements (§7)
// ---------------------------------------------------------------------------

export interface ExpressionStatement extends Span {
  readonly type: 'ExpressionStatement';
  readonly expression: Expression;
}

export interface AssignmentStatement extends Span {
  readonly type: 'AssignmentStatement';
  readonly target: AssignTarget;
  readonly value: Expression;
}

/** One of `ቁጥር` / `እውነታ` / `ጽሁፍ` / `ስብስብ` (§7.2). */
export type DeclaredType = 'NUMBER' | 'BOOLEAN' | 'STRING' | 'LIST';

export interface TypedDeclaration extends Span {
  readonly type: 'TypedDeclaration';
  readonly declaredType: DeclaredType;
  readonly name: string;
  readonly value: Expression;
}

export interface ReturnStatement extends Span {
  readonly type: 'ReturnStatement';
  readonly value: Expression | null;
}

export interface ElifBranch {
  readonly condition: Expression;
  readonly body: Block;
}

export interface IfStatement extends Span {
  readonly type: 'IfStatement';
  readonly condition: Expression;
  readonly consequent: Block;
  readonly elifs: readonly ElifBranch[];
  readonly alternate: Block | null;
}

export interface WhileStatement extends Span {
  readonly type: 'WhileStatement';
  readonly condition: Expression;
  readonly body: Block;
}

export interface FunctionDeclaration extends Span {
  readonly type: 'FunctionDeclaration';
  readonly name: string;
  readonly params: readonly string[];
  readonly body: Block;
}

/** `ፍጠር(…)፦` — a class's constructor (§7.6). */
export interface ConstructorDeclaration extends Span {
  readonly type: 'ConstructorDeclaration';
  readonly params: readonly string[];
  readonly body: Block;
}

/** `name = <expr>` in a class body, optionally type-annotated (§7.6). */
export interface AttributeDeclaration extends Span {
  readonly type: 'AttributeDeclaration';
  readonly name: string;
  readonly declaredType: DeclaredType | null;
  readonly value: Expression;
}

/**
 * A class body is structured, not a statement list: attributes, at most one
 * constructor, and methods. v1-ts modelled it as a plain block and lost the
 * distinction (CHANGES C03).
 */
export interface ClassDeclaration extends Span {
  readonly type: 'ClassDeclaration';
  readonly name: string;
  readonly parent: string | null;
  readonly attributes: readonly AttributeDeclaration[];
  readonly constructor: ConstructorDeclaration | null;
  readonly methods: readonly FunctionDeclaration[];
}

export type Statement =
  | ExpressionStatement
  | AssignmentStatement
  | TypedDeclaration
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | FunctionDeclaration
  | ClassDeclaration;

// ---------------------------------------------------------------------------
// Structure (§5)
// ---------------------------------------------------------------------------

export interface Block extends Span {
  readonly type: 'Block';
  readonly statements: readonly Statement[];
}

export interface Program extends Span {
  readonly type: 'Program';
  readonly body: readonly Statement[];
}

export type Node =
  Program | Block | Statement | Expression | AttributeDeclaration | ConstructorDeclaration;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A span covering both of its arguments. */
export function spanning(from: Span, to: Span): Span {
  return {
    line: from.line,
    startCol: from.startCol,
    endLine: to.endLine,
    endCol: to.endCol,
  };
}

/** `line:startCol-endLine:endCol`, the form `ahadu ast` prints (TOOLING.md §1.1). */
export function formatSpan(s: Span): string {
  return `${s.line}:${s.startCol}-${s.endLine}:${s.endCol}`;
}
