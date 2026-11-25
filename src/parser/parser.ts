/**
 * The parser: tokens → AST (LANGUAGE.md §5–7, GRAMMAR.ebnf, §9.3).
 *
 * The shape of this file follows the grammar, one method per production, so
 * that the two can be checked against each other by reading.
 *
 * Three things drive the design:
 *
 * 1. **The condition comes before the keyword** (§7.3, §7.4). A statement
 *    starts by parsing an expression, and only then looks at the next token
 *    to find out what the expression *was*: a condition, an assignment
 *    target, or a statement on its own. One token of lookahead past the
 *    expression, no backtracking. v1-ts parsed `ከሆነ` first and so could not
 *    read a single program from the original repository (CHANGES C01).
 * 2. **It never throws and always returns a `Program`** (§9.3), with
 *    `InvalidExpression` standing in where a sub-expression could not be
 *    built, so an editor can keep working on a half-typed file.
 * 3. **One report per bad line.** After a diagnostic the parser is
 *    "panicking" and stays quiet until it resynchronizes at a line break,
 *    so a single mistake does not cascade into a wall of noise.
 */

import type { Diagnostic } from '../diagnostics.js';
import {
  AH2001,
  AH2002,
  AH2003,
  AH2004,
  AH2005,
  AH2006,
  AH2007,
  AH2008,
  AH2009,
  AH2010,
  AH2011,
  AH2012,
  AH2013,
  AH2014,
  AH2015,
  diagnostic,
  sortDiagnostics,
} from '../diagnostics.js';
import type { KeywordType, Token, TokenType } from '../lexer/index.js';
import { RESERVED_SPELLINGS } from '../lexer/index.js';
import type {
  AttributeDeclaration,
  BinaryOperator,
  Block,
  ConstructorDeclaration,
  DeclaredType,
  ElifBranch,
  Expression,
  FunctionDeclaration,
  Program,
  Span,
  Statement,
} from './ast.js';
import { spanning } from './ast.js';
import * as msg from './messages.js';

export interface ParseResult {
  readonly program: Program;
  readonly diagnostics: readonly Diagnostic[];
}

/** Comparison operators, which are non-associative (§6.1). */
const COMPARISON: Partial<Record<TokenType, BinaryOperator>> = {
  EQ: 'EQ',
  NEQ: 'NEQ',
  LT: 'LT',
  LTE: 'LTE',
  GT: 'GT',
  GTE: 'GTE',
};

const ADDITIVE: Partial<Record<TokenType, BinaryOperator>> = { PLUS: 'ADD', MINUS: 'SUB' };

const MULTIPLICATIVE: Partial<Record<TokenType, BinaryOperator>> = {
  STAR: 'MUL',
  SLASH: 'DIV',
  PERCENT: 'MOD',
};

/** Type annotation keywords → the declared type they name (§7.2). */
const DECLARED_TYPES: Partial<Record<KeywordType, DeclaredType>> = {
  TYPE_NUM: 'NUMBER',
  TYPE_BOOL: 'BOOLEAN',
  TYPE_STRING: 'STRING',
  TYPE_LIST: 'LIST',
};

/** How a statement ended (§5.1). */
type Terminator = 'newline' | 'stop' | 'eof' | 'missing';

/**
 * Statements whose last part is an indented block.
 *
 * A block swallows the line breaks inside it, so by the time one of these
 * finishes, the line it started on is long gone and there is no terminator
 * left to ask for. Asking anyway reports a phantom error against the *next*
 * line's indentation and then drops that line.
 */
function endsWithBlock(statement: Statement): boolean {
  return (
    statement.type === 'IfStatement' ||
    statement.type === 'WhileStatement' ||
    statement.type === 'ForEachStatement' ||
    statement.type === 'FunctionDeclaration' ||
    statement.type === 'ClassDeclaration'
  );
}

/** Tokens a panicking parser may stop in front of without consuming. */
const CLOSERS: ReadonlySet<TokenType> = new Set<TokenType>([
  'RPAREN',
  'RBRACKET',
  'NEWLINE',
  'STOP',
  'EOF',
  'THEN',
  'COMMA',
  'COLON',
]);

class Parser {
  private readonly tokens: readonly Token[];
  private pos = 0;
  private readonly diagnostics: Diagnostic[] = [];

  /**
   * Depth of unclosed `(` and `[`. While it is above zero, NEWLINE and INDENT
   * tokens are skipped, which is what lets an argument list or a list literal
   * span lines (§5.1).
   */
  private groupDepth = 0;
  /** Suppresses reports until the next resynchronization. */
  private panicking = false;
  /**
   * Expressions that came from inside `( … )`.
   *
   * Parentheses leave no node in the tree — `(ሀ + ለ) * ሐ` needs none, since
   * the shape already records the grouping. But `(ሀ) = 1` has to be refused
   * (§7.1), which means remembering that `ሀ` arrived wrapped. A set the
   * parser keeps to itself does that without putting a node in the AST that
   * every later stage would have to unwrap.
   */
  private readonly grouped = new WeakSet<object>();
  /** `ተመላሽ` is only legal inside a function (§7.5). */
  private functionDepth = 0;
  /** `ፍጠር` may not return a value (§7.6). */
  private inConstructor = false;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
    this.normalize();
  }

  // =========================================================================
  // Cursor
  // =========================================================================

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)] as Token;
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  /** Inside brackets, line structure carries no meaning (§5.1). */
  private normalize(): void {
    if (this.groupDepth === 0) return;
    while (this.pos < this.tokens.length - 1) {
      const t = this.tokens[this.pos] as Token;
      if (t.type !== 'NEWLINE' && t.type !== 'INDENT') break;
      this.pos += 1;
    }
  }

  private advance(): Token {
    const t = this.peek();
    if (!this.isAtEnd()) this.pos += 1;
    this.normalize();
    return t;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private checkKeyword(sub: KeywordType): boolean {
    const t = this.peek();
    return t.type === 'KEYWORD' && t.value === sub;
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  private openGroup(): Token {
    const t = this.peek();
    this.groupDepth += 1;
    this.pos += 1;
    this.normalize();
    return t;
  }

  /** Consumes the matching closer, or reports `AH2002` and leaves the cursor put. */
  private closeGroup(closer: TokenType, open: Token): Token | null {
    this.groupDepth = Math.max(0, this.groupDepth - 1);
    if (this.check(closer)) return this.advance();
    // Naming the opener's line matters most in exactly the case that is
    // hardest to see: a bracket left open several lines earlier.
    this.report(AH2002, this.peek(), msg.missingCloser(closer === 'RPAREN' ? ')' : ']', open.line));
    return null;
  }

  // =========================================================================
  // Diagnostics
  // =========================================================================

  private report(code: string, at: Token | Span, message: string): void {
    if (this.panicking) return;
    this.panicking = true;
    this.diagnostics.push(diagnostic(code, 'parser', at.line, at.startCol, at.endCol, message));
  }

  /**
   * Consumes every following line indented deeper than `parentIndent`.
   *
   * Used when a block could not be opened: the lines underneath it were
   * meant to be its body, and reporting each of them as over-indented would
   * turn one mistake into a column of them.
   */
  private skipIndentedLines(parentIndent: number): void {
    for (;;) {
      const line = this.peekLine();
      if (line === null || line.indent <= parentIndent) return;
      this.pos = line.index;
      while (!this.isAtEnd() && !this.check('NEWLINE')) this.pos += 1;
      if (this.check('NEWLINE')) this.pos += 1;
    }
  }

  /**
   * Reports, abandons the line, and swallows the indented block that was
   * about to follow it.
   *
   * Statement keywords that open blocks fail as a unit: `አለበለዚያ፦` with no
   * `ከሆነ` in front of it is one mistake, and the lines indented under it are
   * its orphaned body rather than four more errors.
   */
  private failStatement(code: string, at: Token, message: string, indent: number): null {
    this.report(code, at, message);
    this.synchronize();
    this.skipIndentedLines(indent);
    return null;
  }

  /** Skips to the end of the logical line and clears panic mode (§9.3). */
  private synchronize(): void {
    this.groupDepth = 0;
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (t.type === 'NEWLINE' || t.type === 'STOP') {
        this.pos += 1;
        break;
      }
      this.pos += 1;
    }
    this.panicking = false;
  }

  // =========================================================================
  // Lines and indentation (§3.7, §5.2)
  // =========================================================================

  /**
   * Looks past blank lines to the next line's indent level and first real
   * token, consuming nothing. Returns null at end of input.
   */
  private peekLine(): { indent: number; token: Token; index: number } | null {
    let i = this.pos;
    while (this.tokens[i]?.type === 'NEWLINE') i += 1;
    let indent = 0;
    while (this.tokens[i]?.type === 'INDENT') {
      indent += 1;
      i += 1;
    }
    const token = this.tokens[i];
    if (token === undefined || token.type === 'EOF') return null;
    return { indent, token, index: i };
  }

  // =========================================================================
  // Program and statement lists
  // =========================================================================

  parse(): ParseResult {
    const first = this.peek();
    const body = this.parseStatements(0, false);
    const last = body.at(-1);

    const program: Program = {
      type: 'Program',
      body,
      line: body.length > 0 ? (body[0] as Statement).line : first.line,
      startCol: body.length > 0 ? (body[0] as Statement).startCol : first.startCol,
      endLine: last?.endLine ?? first.line,
      endCol: last?.endCol ?? first.endCol,
    };

    return { program, diagnostics: sortDiagnostics(this.diagnostics) };
  }

  /**
   * Parses every statement at `expected` indentation.
   *
   * With `isBlock`, a line indented less deeply ends the list and is left for
   * the caller — that is how a block knows where it stops (§5.2).
   */
  private parseStatements(expected: number, isBlock: boolean): Statement[] {
    const statements: Statement[] = [];

    for (;;) {
      const line = this.peekLine();
      if (line === null) break;
      if (isBlock && line.indent < expected) break;

      if (line.indent > expected) {
        // Deeper than the opener allows. Report once, then parse the line
        // anyway so a stray indent does not swallow the rest of the block.
        this.report(AH2015, line.token, msg.overIndented(expected, line.indent));
      }

      this.pos = line.index;
      this.parseLine(expected, statements);
    }

    return statements;
  }

  /** Parses one logical line, which `።` may pack with several statements (§5.1). */
  private parseLine(indent: number, into: Statement[]): void {
    for (;;) {
      const before = this.pos;
      const statement = this.parseStatement(indent);
      if (statement !== null) into.push(statement);

      if (this.pos === before) {
        // No progress: force some, or we would spin here forever.
        this.synchronize();
        return;
      }

      // A statement that failed has already reported, and has already left
      // the cursor somewhere sensible. Asking it for a terminator as well
      // would report a second time for one mistake.
      if (statement === null) return;
      if (endsWithBlock(statement)) return;

      const terminator = this.consumeTerminator();
      if (terminator !== 'stop') return;
      if (this.check('NEWLINE') || this.isAtEnd()) return;
    }
  }

  private atStatementEnd(): boolean {
    return this.check('NEWLINE') || this.check('STOP') || this.isAtEnd();
  }

  private consumeTerminator(): Terminator {
    if (this.check('NEWLINE')) {
      this.advance();
      this.panicking = false;
      return 'newline';
    }
    if (this.check('STOP')) {
      this.advance();
      this.panicking = false;
      return 'stop';
    }
    if (this.isAtEnd()) {
      this.panicking = false;
      return 'eof';
    }

    // Something is left over on the line. A second `=` is common enough to
    // name outright (§7.1).
    this.report(
      AH2001,
      this.peek(),
      this.check('ASSIGN') ? msg.CHAINED_ASSIGNMENT : msg.UNEXPECTED_AFTER_STATEMENT,
    );
    this.synchronize();
    return 'missing';
  }

  // =========================================================================
  // Statements (§7)
  // =========================================================================

  private parseStatement(indent: number): Statement | null {
    const t = this.peek();

    if (t.type === 'KEYWORD') {
      const sub = t.value as KeywordType;

      if (sub === 'RETURN') return this.parseReturn();
      if (sub === 'FUNC') return this.parseFunction(indent);
      if (sub === 'CLASS') return this.parseClass(indent);
      if (DECLARED_TYPES[sub] !== undefined) return this.parseTypedDeclaration();

      // A `ግን` or `አለበለዚያ` that reaches statement position has no `ከሆነ` in
      // front of it — a valid one is consumed by parseIfTail (§7.3).
      if (sub === 'ELIF' || sub === 'ELSE') {
        const detail = sub === 'ELIF' ? msg.ELIF_WITHOUT_IF : msg.ELSE_WITHOUT_IF;
        return this.failStatement(AH2004, t, detail, indent);
      }

      // The keyword-first shape, which is what v1-ts accepted and what someone
      // arriving from another language will write. Worth naming precisely.
      if (sub === 'IF' || sub === 'WHILE') {
        const detail = sub === 'IF' ? msg.CONDITION_BEFORE_IF : msg.CONDITION_BEFORE_WHILE;
        return this.failStatement(AH2001, t, detail, indent);
      }

      // Same mistake, same treatment: `ለእያንዳንዱ ስም በቤተሰብ፦` is the shape
      // someone arriving from another language writes (§7.4).
      if (sub === 'FOREACH') {
        return this.failStatement(AH2001, t, msg.COLLECTION_BEFORE_FOREACH, indent);
      }

      if (sub === 'INIT') {
        return this.failStatement(AH2001, t, msg.INIT_OUTSIDE_CLASS, indent);
      }

      if (sub.startsWith('RESERVED_')) {
        const detail = msg.reservedWord(RESERVED_SPELLINGS[sub] ?? sub);
        return this.failStatement(AH2010, t, detail, indent);
      }
    }

    // Expression-led: parse it, then find out what it was (§7.3).
    const expression = this.parseExpression();

    if (this.checkKeyword('IF')) return this.parseIfTail(expression, indent);
    if (this.checkKeyword('WHILE')) return this.parseWhileTail(expression, indent);
    if (this.checkKeyword('FOREACH')) return this.parseForEachTail(expression, indent);
    if (this.check('ASSIGN')) return this.parseAssignment(expression);

    return { type: 'ExpressionStatement', expression, ...spanning(expression, expression) };
  }

  private parseReturn(): Statement {
    const kw = this.advance();

    if (this.functionDepth === 0) this.report(AH2005, kw, msg.RETURN_OUTSIDE_FUNCTION);

    let value: Expression | null = null;
    if (!this.atStatementEnd()) {
      value = this.parseExpression();
      if (this.inConstructor) this.report(AH2014, kw, msg.RETURN_IN_CONSTRUCTOR);
    }

    return {
      type: 'ReturnStatement',
      value,
      line: kw.line,
      startCol: kw.startCol,
      endLine: value?.endLine ?? kw.line,
      endCol: value?.endCol ?? kw.endCol,
    };
  }

  private parseTypedDeclaration(): Statement | null {
    const kw = this.advance();
    const declaredType = DECLARED_TYPES[kw.value as KeywordType] as DeclaredType;

    if (!this.check('IDENTIFIER')) {
      this.report(AH2001, this.peek(), msg.EXPECTED_VARIABLE_NAME);
      this.synchronize();
      return null;
    }
    const name = this.advance();

    if (!this.match('ASSIGN')) {
      this.report(AH2007, name, msg.declarationNeedsValue(String(name.value)));
      this.synchronize();
      return null;
    }

    const value = this.parseExpression();
    return {
      type: 'TypedDeclaration',
      declaredType,
      name: String(name.value),
      value,
      line: kw.line,
      startCol: kw.startCol,
      endLine: value.endLine,
      endCol: value.endCol,
    };
  }

  private parseAssignment(target: Expression): Statement | null {
    this.advance(); // =
    const value = this.parseExpression();

    if (target.type === 'SliceAccess') {
      this.report(AH2009, target, msg.SLICE_ASSIGNMENT);
      return null;
    }
    if (
      this.grouped.has(target) ||
      (target.type !== 'Identifier' &&
        target.type !== 'MemberAccess' &&
        target.type !== 'IndexAccess')
    ) {
      this.report(AH2011, target, msg.INVALID_TARGET);
      return null;
    }

    // The guards above have narrowed `target` to an AssignTarget.
    return {
      type: 'AssignmentStatement',
      target,
      value,
      ...spanning(target, value),
    };
  }

  /** `<condition> ከሆነ፦` — the condition is already parsed (§7.3). */
  private parseIfTail(condition: Expression, indent: number): Statement {
    this.advance(); // ከሆነ
    const consequent = this.parseBlock(indent);

    const elifs: ElifBranch[] = [];
    for (;;) {
      const line = this.peekLine();
      if (line === null || line.indent !== indent) break;
      if (!(line.token.type === 'KEYWORD' && line.token.value === 'ELIF')) break;

      this.pos = line.index;
      this.advance(); // ግን
      const elifCondition = this.parseExpression();

      if (!this.checkKeyword('IF')) {
        this.report(AH2003, line.token, msg.ELIF_NEEDS_IF);
      } else {
        this.advance();
      }

      elifs.push({ condition: elifCondition, body: this.parseBlock(indent) });
    }

    let alternate: Block | null = null;
    const line = this.peekLine();
    if (line !== null && line.indent === indent) {
      if (line.token.type === 'KEYWORD' && line.token.value === 'ELSE') {
        this.pos = line.index;
        this.advance(); // አለበለዚያ
        alternate = this.parseBlock(indent);
      }
    }

    const last = alternate ?? elifs.at(-1)?.body ?? consequent;
    return {
      type: 'IfStatement',
      condition,
      consequent,
      elifs,
      alternate,
      ...spanning(condition, last),
    };
  }

  /** `<condition> እስከሆነ ድረስ፦` (§7.4). */
  private parseWhileTail(condition: Expression, indent: number): Statement {
    this.advance(); // እስከሆነ ድረስ
    const body = this.parseBlock(indent);
    return { type: 'WhileStatement', condition, body, ...spanning(condition, body) };
  }

  /** `<collection> ለእያንዳንዱ <name>፦` (§7.4). */
  private parseForEachTail(collection: Expression, indent: number): Statement {
    const kw = this.advance(); // ለእያንዳንዱ

    // A missing name is reported but does not abandon the statement: the block
    // is still parsed, so one forgotten word does not cascade into every line
    // of the body (§9.3).
    let name = '';
    if (this.check('IDENTIFIER')) {
      name = String(this.advance().value);
    } else {
      this.report(AH2001, this.peek() ?? kw, msg.FOREACH_NEEDS_NAME);
    }

    const body = this.parseBlock(indent);
    return {
      type: 'ForEachStatement',
      collection,
      name,
      body,
      ...spanning(collection, body),
    };
  }

  private parseFunction(indent: number): FunctionDeclaration {
    const kw = this.advance(); // ተግባር

    let name = '';
    if (this.check('IDENTIFIER')) {
      name = String(this.advance().value);
    } else {
      this.report(AH2001, this.peek(), msg.EXPECTED_FUNCTION_NAME);
    }

    const params = this.parseParams();
    const body = this.parseFunctionBody(indent, false);

    return {
      type: 'FunctionDeclaration',
      name,
      params,
      body,
      line: kw.line,
      startCol: kw.startCol,
      endLine: body.endLine,
      endCol: body.endCol,
    };
  }

  /** Parses a block body with `ተመላሽ` legal inside it (§7.5). */
  private parseFunctionBody(indent: number, isConstructor: boolean): Block {
    const outerConstructor = this.inConstructor;
    this.functionDepth += 1;
    this.inConstructor = isConstructor;
    try {
      return this.parseBlock(indent);
    } finally {
      this.functionDepth -= 1;
      this.inConstructor = outerConstructor;
    }
  }

  private parseParams(): string[] {
    const params: string[] = [];

    if (!this.check('LPAREN')) {
      this.report(AH2001, this.peek(), msg.EXPECTED_LPAREN);
      return params;
    }
    const open = this.openGroup();

    if (!this.check('RPAREN')) {
      for (;;) {
        if (!this.check('IDENTIFIER')) {
          this.report(AH2001, this.peek(), msg.EXPECTED_PARAMETER);
          break;
        }
        const token = this.advance();
        const param = String(token.value);
        if (params.includes(param)) {
          this.report(AH2012, token, msg.duplicateParameter(param));
        }
        params.push(param);

        if (!this.match('COMMA')) break;
        if (this.check('RPAREN')) {
          this.report(AH2001, this.peek(), msg.TRAILING_COMMA);
          break;
        }
      }
    }

    this.closeGroup('RPAREN', open);
    return params;
  }

  private parseClass(indent: number): Statement {
    const kw = this.advance(); // ክላስ

    let name = '';
    if (this.check('IDENTIFIER')) {
      name = String(this.advance().value);
    } else {
      this.report(AH2001, this.peek(), msg.EXPECTED_CLASS_NAME);
    }

    let parent: string | null = null;
    if (this.check('LPAREN')) {
      const open = this.openGroup();
      if (this.check('IDENTIFIER')) {
        parent = String(this.advance().value);
      } else {
        this.report(AH2001, this.peek(), msg.EXPECTED_PARENT_NAME);
      }
      this.closeGroup('RPAREN', open);
    }

    const attributes: AttributeDeclaration[] = [];
    const methods: FunctionDeclaration[] = [];
    let ctor: ConstructorDeclaration | null = null;
    let end: Span = { line: kw.line, startCol: kw.startCol, endLine: kw.line, endCol: kw.endCol };

    if (!this.openBlock()) {
      this.skipIndentedLines(indent);
      return {
        type: 'ClassDeclaration',
        name,
        parent,
        attributes,
        constructor: ctor,
        methods,
        ...end,
      };
    }

    const inner = indent + 1;
    const firstLine = this.peekLine();
    if (firstLine === null || firstLine.indent < inner) {
      this.report(AH2006, kw, msg.EMPTY_CLASS_BODY);
    }

    for (;;) {
      const line = this.peekLine();
      if (line === null || line.indent < inner) break;
      if (line.indent > inner)
        this.report(AH2015, line.token, msg.overIndented(inner, line.indent));
      this.pos = line.index;

      const t = this.peek();
      const before = this.pos;

      if (t.type === 'KEYWORD' && t.value === 'FUNC') {
        const method = this.parseFunction(inner);
        methods.push(method);
        end = method;
      } else if (t.type === 'KEYWORD' && t.value === 'INIT') {
        const next = this.parseConstructor(inner);
        if (ctor !== null) this.report(AH2013, t, msg.DUPLICATE_CONSTRUCTOR);
        else ctor = next;
        end = next;
      } else {
        const attribute = this.parseAttribute();
        if (attribute !== null) {
          attributes.push(attribute);
          end = attribute;
          this.consumeTerminator();
        } else {
          // The member failed, and anything indented under it was its body.
          this.skipIndentedLines(inner);
        }
      }

      if (this.pos === before) this.synchronize();
    }

    return {
      type: 'ClassDeclaration',
      name,
      parent,
      attributes,
      constructor: ctor,
      methods,
      line: kw.line,
      startCol: kw.startCol,
      endLine: end.endLine,
      endCol: end.endCol,
    };
  }

  private parseConstructor(indent: number): ConstructorDeclaration {
    const kw = this.advance(); // ፍጠር
    const params = this.parseParams();
    const body = this.parseFunctionBody(indent, true);
    return {
      type: 'ConstructorDeclaration',
      params,
      body,
      line: kw.line,
      startCol: kw.startCol,
      endLine: body.endLine,
      endCol: body.endCol,
    };
  }

  /** `[type] name = <expr>` in a class body (§7.6). */
  private parseAttribute(): AttributeDeclaration | null {
    const start = this.peek();
    let declaredType: DeclaredType | null = null;

    if (start.type === 'KEYWORD') {
      const named = DECLARED_TYPES[start.value as KeywordType];
      if (named === undefined) {
        this.report(AH2013, start, msg.ILLEGAL_CLASS_MEMBER);
        this.synchronize();
        return null;
      }
      declaredType = named;
      this.advance();
    }

    if (!this.check('IDENTIFIER')) {
      this.report(AH2013, this.peek(), msg.ILLEGAL_CLASS_MEMBER);
      this.synchronize();
      return null;
    }
    const name = this.advance();

    if (!this.match('ASSIGN')) {
      this.report(AH2013, name, msg.attributeNeedsValue(String(name.value)));
      this.synchronize();
      return null;
    }

    const value = this.parseExpression();
    return {
      type: 'AttributeDeclaration',
      name: String(name.value),
      declaredType,
      value,
      line: start.line,
      startCol: start.startCol,
      endLine: value.endLine,
      endCol: value.endCol,
    };
  }

  // =========================================================================
  // Blocks (§5.2)
  // =========================================================================

  /** Consumes `፦` and the newline after it. Returns false if the block cannot start. */
  private openBlock(): boolean {
    if (!this.check('THEN')) {
      this.report(AH2001, this.peek(), msg.EXPECTED_THEN);
      this.synchronize();
      return false;
    }
    this.advance();

    if (this.check('NEWLINE')) {
      this.advance();
      return true;
    }
    if (this.isAtEnd()) return false;

    // An inline body. 2.0 has one block shape, on its own indented line
    // (§5.2, CHANGES C06).
    this.report(AH2001, this.peek(), msg.INLINE_BLOCK);
    this.synchronize();
    return false;
  }

  private parseBlock(parentIndent: number): Block {
    const opener = this.peek();
    const empty: Block = {
      type: 'Block',
      statements: [],
      line: opener.line,
      startCol: opener.startCol,
      endLine: opener.line,
      endCol: opener.endCol,
    };

    if (!this.openBlock()) {
      this.skipIndentedLines(parentIndent);
      return empty;
    }

    const inner = parentIndent + 1;
    const line = this.peekLine();
    if (line === null || line.indent < inner) {
      this.report(AH2006, opener, msg.EMPTY_BLOCK);
      return empty;
    }

    const reportedBefore = this.diagnostics.length;
    const statements = this.parseStatements(inner, true);
    if (statements.length === 0) {
      // Empty because its one statement failed, not because nothing was
      // written: that mistake has already been reported.
      if (this.diagnostics.length === reportedBefore) {
        this.report(AH2006, opener, msg.EMPTY_BLOCK);
      }
      return empty;
    }

    const first = statements[0] as Statement;
    const last = statements[statements.length - 1] as Statement;
    return {
      type: 'Block',
      statements,
      line: first.line,
      startCol: first.startCol,
      endLine: last.endLine,
      endCol: last.endCol,
    };
  }

  // =========================================================================
  // Expressions (§6.1) — one method per precedence level, loosest first
  // =========================================================================

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.checkKeyword('OR')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryExpression', operator: 'OR', left, right, ...spanning(left, right) };
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseNot();
    while (this.checkKeyword('AND')) {
      this.advance();
      const right = this.parseNot();
      left = { type: 'BinaryExpression', operator: 'AND', left, right, ...spanning(left, right) };
    }
    return left;
  }

  private parseNot(): Expression {
    if (this.checkKeyword('NOT')) {
      const kw = this.advance();
      const operand = this.parseNot();
      return {
        type: 'UnaryExpression',
        operator: 'NOT',
        operand,
        line: kw.line,
        startCol: kw.startCol,
        endLine: operand.endLine,
        endCol: operand.endCol,
      };
    }
    return this.parseComparison();
  }

  /**
   * Comparison is **non-associative**: `ሀ < ለ < ሐ` is `AH2008`, not
   * `(ሀ < ለ) < ሐ`, which is a plausible beginner mistake that otherwise
   * produces a plausible-looking answer (§6.1, CHANGES C39).
   */
  private parseComparison(): Expression {
    const left = this.parseAdditive();
    const operator = COMPARISON[this.peek().type];
    if (operator === undefined) return left;

    this.advance();
    const right = this.parseAdditive();
    const node: Expression = {
      type: 'BinaryExpression',
      operator,
      left,
      right,
      ...spanning(left, right),
    };

    if (COMPARISON[this.peek().type] !== undefined) {
      this.report(AH2008, this.peek(), msg.CHAINED_COMPARISON);
    }
    return node;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    for (;;) {
      const operator = ADDITIVE[this.peek().type];
      if (operator === undefined) return left;
      this.advance();
      const right = this.parseMultiplicative();
      left = { type: 'BinaryExpression', operator, left, right, ...spanning(left, right) };
    }
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();
    for (;;) {
      const operator = MULTIPLICATIVE[this.peek().type];
      if (operator === undefined) return left;
      this.advance();
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator, left, right, ...spanning(left, right) };
    }
  }

  private parseUnary(): Expression {
    if (this.check('MINUS')) {
      const op = this.advance();
      const operand = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: 'NEG',
        operand,
        line: op.line,
        startCol: op.startCol,
        endLine: operand.endLine,
        endCol: operand.endCol,
      };
    }
    return this.parsePower();
  }

  /**
   * `^` is right-associative and binds tighter than unary minus on its left,
   * so `-2 ^ 2` is `-(2 ^ 2)` and `2 ^ -1` is legal (§6.1).
   */
  private parsePower(): Expression {
    const base = this.parsePostfix();
    if (!this.check('CARET')) return base;
    this.advance();
    const exponent = this.parseUnary();
    return {
      type: 'BinaryExpression',
      operator: 'POW',
      left: base,
      right: exponent,
      ...spanning(base, exponent),
    };
  }

  private parsePostfix(): Expression {
    let expression = this.parsePrimary();

    for (;;) {
      if (this.check('LPAREN')) {
        expression = this.parseCall(expression);
        continue;
      }
      if (this.check('LBRACKET')) {
        expression = this.parseIndexOrSlice(expression);
        continue;
      }
      if (this.check('DOT')) {
        this.advance();
        if (!this.check('IDENTIFIER')) {
          this.report(AH2001, this.peek(), msg.EXPECTED_MEMBER_NAME);
          return expression;
        }
        const property = this.advance();
        expression = {
          type: 'MemberAccess',
          object: expression,
          property: String(property.value),
          spelling: 'dot',
          ...spanning(expression, {
            line: property.line,
            startCol: property.startCol,
            endLine: property.line,
            endCol: property.endCol,
          }),
        };
        continue;
      }
      return expression;
    }
  }

  private parseCall(callee: Expression): Expression {
    const open = this.openGroup();
    const args: Expression[] = [];

    if (!this.check('RPAREN')) {
      for (;;) {
        args.push(this.parseExpression());
        if (!this.match('COMMA')) break;
        if (this.check('RPAREN')) {
          this.report(AH2001, this.peek(), msg.TRAILING_COMMA);
          break;
        }
      }
    }

    const close = this.closeGroup('RPAREN', open);
    return {
      type: 'CallExpression',
      callee,
      args,
      ...this.spanTo(callee, close, args.at(-1)),
    };
  }

  private parseIndexOrSlice(target: Expression): Expression {
    const open = this.openGroup();

    let from: Expression | null = null;
    let isSlice = false;

    if (this.check('COLON')) {
      isSlice = true;
      this.advance();
    } else {
      from = this.parseExpression();
      if (this.check('COLON')) {
        isSlice = true;
        this.advance();
      }
    }

    let to: Expression | null = null;
    if (isSlice && !this.check('RBRACKET')) {
      to = this.parseExpression();
    }

    const close = this.closeGroup('RBRACKET', open);
    const span = this.spanTo(target, close, to ?? from ?? undefined);

    if (isSlice) return { type: 'SliceAccess', target, from, to, ...span };
    return {
      type: 'IndexAccess',
      target,
      index: from ?? this.invalidAt(open),
      ...span,
    };
  }

  private parsePrimary(): Expression {
    const t = this.peek();

    switch (t.type) {
      case 'NUMBER':
        this.advance();
        return { type: 'NumberLiteral', value: t.value as number, ...this.tokenSpan(t) };

      case 'STRING':
        this.advance();
        return { type: 'StringLiteral', value: String(t.value), ...this.tokenSpan(t) };

      case 'IDENTIFIER':
        return this.parseIdentifier();

      case 'LBRACKET':
        return this.parseListLiteral();

      case 'LPAREN': {
        const open = this.openGroup();
        const inner = this.parseExpression();
        this.closeGroup('RPAREN', open);
        this.grouped.add(inner);
        return inner;
      }

      case 'KEYWORD': {
        const sub = t.value as KeywordType;
        if (sub === 'TRUE' || sub === 'FALSE') {
          this.advance();
          return { type: 'BooleanLiteral', value: sub === 'TRUE', ...this.tokenSpan(t) };
        }
        if (sub === 'NOTHING') {
          this.advance();
          return { type: 'NothingLiteral', ...this.tokenSpan(t) };
        }
        if (sub.startsWith('RESERVED_')) {
          this.report(AH2010, t, msg.reservedWord(RESERVED_SPELLINGS[sub] ?? sub));
          this.advance();
          return this.invalidAt(t);
        }
        if (sub === 'IF' || sub === 'WHILE') {
          this.report(
            AH2001,
            t,
            sub === 'IF' ? msg.CONDITION_BEFORE_IF : msg.CONDITION_BEFORE_WHILE,
          );
          return this.invalidAt(t);
        }
        this.report(AH2001, t, msg.EXPECTED_EXPRESSION);
        return this.invalidAt(t);
      }

      default:
        break;
    }

    this.report(AH2001, t, msg.EXPECTED_EXPRESSION);
    // Leave a closer where it is so the enclosing construct can report on it;
    // consume anything else, so the caller always makes progress.
    if (!CLOSERS.has(t.type)) this.advance();
    return this.invalidAt(t);
  }

  /**
   * An identifier, or the possessive `የobj attr` when an identifier follows
   * one that carries the prefix (§3.3, §6.4).
   */
  private parseIdentifier(): Expression {
    const t = this.advance();

    if (t.hasOfPrefix === true && this.check('IDENTIFIER')) {
      const property = this.advance();
      // The የ is one code point, so the object's own span starts after it.
      const object: Expression = {
        type: 'Identifier',
        name: String(t.stem),
        line: t.line,
        startCol: t.startCol + 1,
        endLine: t.line,
        endCol: t.endCol,
      };
      return {
        type: 'MemberAccess',
        object,
        property: String(property.value),
        spelling: 'of',
        line: t.line,
        startCol: t.startCol,
        endLine: property.line,
        endCol: property.endCol,
      };
    }

    return { type: 'Identifier', name: String(t.value), ...this.tokenSpan(t) };
  }

  private parseListLiteral(): Expression {
    const open = this.openGroup();
    const elements: Expression[] = [];

    if (!this.check('RBRACKET')) {
      for (;;) {
        elements.push(this.parseExpression());
        if (!this.match('COMMA')) break;
        if (this.check('RBRACKET')) {
          this.report(AH2001, this.peek(), msg.TRAILING_COMMA);
          break;
        }
      }
    }

    const close = this.closeGroup('RBRACKET', open);
    return {
      type: 'ListLiteral',
      elements,
      ...this.spanTo(
        { line: open.line, startCol: open.startCol, endLine: open.line, endCol: open.endCol },
        close,
        elements.at(-1),
      ),
    };
  }

  // =========================================================================
  // Span helpers
  // =========================================================================

  private tokenSpan(t: Token): Span {
    return { line: t.line, startCol: t.startCol, endLine: t.line, endCol: t.endCol };
  }

  /** Spans `from` to the closing token, or to the last thing parsed if it is missing. */
  private spanTo(from: Span, close: Token | null, fallback: Span | undefined): Span {
    if (close !== null) return spanning(from, this.tokenSpan(close));
    return spanning(from, fallback ?? from);
  }

  private invalidAt(at: Token | Span): Expression {
    return {
      type: 'InvalidExpression',
      line: at.line,
      startCol: at.startCol,
      endLine: 'endLine' in at ? at.endLine : at.line,
      endCol: at.endCol,
    };
  }
}

/**
 * Parses a token stream into a `Program`.
 *
 * Never throws, and always returns a program — possibly holding
 * `InvalidExpression` placeholders — so an editor can keep working on a file
 * that is halfway typed (§9.3). Diagnostics come back sorted into source
 * order.
 */
export function parse(tokens: readonly Token[]): ParseResult {
  return new Parser(tokens).parse();
}
