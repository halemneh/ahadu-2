/**
 * The evaluator: AST → values and effects (LANGUAGE.md §4–9).
 *
 * Three things shape it:
 *
 * 1. **`ተመላሽ` returns from anywhere**, by throwing a `ReturnSignal` the call
 *    catches. Deciding once, syntactically, whether a function returns is
 *    what made v1-py discard early returns (CHANGES C17).
 * 2. **Nothing escapes into the host.** Every failure is an `AhaduError`
 *    carrying a diagnostic, caught at the top of `run`. Runaway recursion and
 *    endless loops hit `AH3017` and `AH3018` rather than taking the host down.
 * 3. **No implicit anything.** No truthiness, no coercion, no copying. A
 *    condition must be `እውነታ`; an operator takes the types §6.2 lists; a
 *    list passed to a function is the caller's list.
 */

import type { Diagnostic } from '../diagnostics.js';
import {
  AH3001,
  AH3002,
  AH3003,
  AH3004,
  AH3005,
  AH3006,
  AH3007,
  AH3008,
  AH3009,
  AH3010,
  AH3011,
  AH3012,
  AH3013,
  AH3014,
  AH3015,
  AH3017,
  AH3018,
} from '../diagnostics.js';
import type {
  AssignTarget,
  AttributeDeclaration,
  BinaryExpression,
  Block,
  ClassDeclaration,
  DeclaredType,
  Expression,
  FunctionDeclaration,
  Program,
  Statement,
  TypedDeclaration,
  UnaryExpression,
} from '../parser/index.js';
import * as err from './errors.js';
import { AhaduError, ReturnSignal, runtimeDiagnostic } from './errors.js';
import type { Frame } from './errors.js';
import { Scope, findMethod } from './scope.js';
import type { ClassValue, ListValue, ObjectValue, Site, StringValue, Value } from './values.js';
import {
  NOTHING,
  bool,
  codePoints,
  compareStrings,
  declaredTypeName,
  list,
  matchesDeclaredType,
  num,
  render,
  str,
  stringLength,
  typeName,
  valuesEqual,
} from './values.js';

/** What the interpreter needs from whatever is running it (TOOLING.md §2.3). */
export interface Host {
  /** Receives `ጻፍ` output, newline included. */
  write: (text: string) => void;
  /** Supplies one line for `አንብብ`, without its line break. */
  readLine: (prompt: string | null) => string;
}

export interface RunOptions {
  /** Call-stack limit before `AH3017`. Default 1,000. */
  readonly maxDepth?: number;
  /** Evaluation-step budget before `AH3018`. Unlimited by default. */
  readonly maxSteps?: number;
  /**
   * Called for each statement worth showing, with its line, the value worth
   * showing for it, and how deep in calls it ran. This is what `ahadu trace`
   * prints, so a learner can watch a loop actually loop (TOOLING.md §1.1).
   *
   * "Worth showing" is not the statement's own value: an assignment evaluates
   * to `ምንም` by design (§7.1), but what a learner wants to see is the value
   * that was assigned.
   */
  readonly onStatement?: (line: number, value: Value, depth: number) => void;
}

export interface RunResult {
  /** The value of the last statement, which the REPL prints (TOOLING.md §1.2). */
  readonly value: Value;
  readonly diagnostic: Diagnostic | null;
  /** The call stack when the error happened, outermost first (§9.1). */
  readonly frames: readonly Frame[];
}

/** The deepest line the interpreter was working on, for an error with no site. */
function deepestLine(frames: readonly Frame[]): number {
  return frames.at(-1)?.line ?? 1;
}

/** The global scope's name, as tracebacks show it (§5.3). */
export const GLOBAL_SCOPE_NAME = 'ዋና ፕሮግራም';

/**
 * The default call-depth limit.
 *
 * Each Ahadu call costs a dozen or so JavaScript frames, so the ceiling has
 * to sit well below whatever the host's own stack allows — and that is not
 * knowable from here, since it varies by runtime and by how deeply nested the
 * expressions being evaluated are. 200 is far from any host's cliff and far
 * deeper than a teaching program goes; `run` also catches a genuine stack
 * overflow, so a host with a smaller stack still gets an Ahadu error rather
 * than a crash.
 */
const DEFAULT_MAX_DEPTH = 200;

/** Amharic names for the operations named in `AH3002` messages (§6.2). */
const OPERATION_NAMES: Record<string, string> = {
  ADD: 'መደመር',
  SUB: 'መቀነስ',
  MUL: 'ማባዛት',
  DIV: 'ማካፈል',
  MOD: 'ቀሪ ማግኘት',
  POW: 'ፓወር ማስላት',
  LT: 'ማወዳደር',
  LTE: 'ማወዳደር',
  GT: 'ማወዳደር',
  GTE: 'ማወዳደር',
  NEG: 'መቀነስ',
  NOT: 'መቃረን',
};

export class Interpreter {
  readonly globals = new Scope(null, GLOBAL_SCOPE_NAME);
  private readonly frames: Frame[] = [{ name: GLOBAL_SCOPE_NAME, line: 1 }];

  /** The call stack as it stands, for an error raised outside `fail`. */
  get callStack(): readonly Frame[] {
    return [...this.frames];
  }
  private steps = 0;
  private readonly maxDepth: number;
  private readonly maxSteps: number;
  private readonly onStatement: RunOptions['onStatement'];

  constructor(
    readonly host: Host,
    options: RunOptions = {},
  ) {
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.maxSteps = options.maxSteps ?? Number.POSITIVE_INFINITY;
    this.onStatement = options.onStatement;
    for (const [name, value] of createBuiltins(this)) this.globals.define(name, value);
  }

  // =========================================================================
  // Failing
  // =========================================================================

  /** Raises a runtime error. Always throws; the return type lets callers `return this.fail(...)`. */
  fail(code: string, at: Site, message?: string): never {
    throw new AhaduError(runtimeDiagnostic(code, at, message), [...this.frames]);
  }

  /** Counts a step, so an endless loop ends in an Ahadu error (§9.2). */
  private step(at: Site): void {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      this.fail(AH3018, at, err.stepLimitExceeded(this.maxSteps));
    }
  }

  // =========================================================================
  // Program and statements
  // =========================================================================

  runProgram(program: Program): Value {
    let last: Value = NOTHING;
    for (const statement of program.body) {
      last = this.execute(statement, this.globals);
    }
    return last;
  }

  /**
   * Runs a program and returns the outcome instead of throwing.
   *
   * Separate from `runProgram` so the REPL can feed one interpreter many
   * programs and keep its bindings between them (TOOLING.md §1.2). The step
   * budget is per call, so a long session is not slowly starved of it.
   */
  tryRun(program: Program): RunResult {
    this.steps = 0;
    try {
      return { value: this.runProgram(program), diagnostic: null, frames: [] };
    } catch (thrown) {
      if (thrown instanceof AhaduError) {
        return { value: NOTHING, diagnostic: thrown.diagnosticValue, frames: thrown.frames };
      }
      if (thrown instanceof ReturnSignal) {
        // The parser reports AH2005 for a return outside a function, so this
        // is only reachable if a program was run with diagnostics outstanding.
        return { value: thrown.value, diagnostic: null, frames: [] };
      }
      if (thrown instanceof RangeError) {
        // A real stack overflow, which means the depth limit was set higher
        // than this host can take. Still an Ahadu error: nothing escapes.
        const frames = this.callStack;
        return {
          value: NOTHING,
          diagnostic: runtimeDiagnostic(
            AH3017,
            { line: deepestLine(frames), startCol: 1, endCol: 1 },
            err.callDepthExceeded(frames.length),
          ),
          frames,
        };
      }
      throw thrown;
    }
  }

  /** Runs a block in the scope it was reached from: blocks get no scope (§5.3). */
  private executeBlock(block: Block, scope: Scope): Value {
    let last: Value = NOTHING;
    for (const statement of block.statements) {
      last = this.execute(statement, scope);
    }
    return last;
  }

  /**
   * Reports a statement to the trace hook.
   *
   * Control flow is deliberately not reported: its body statements are, and
   * reporting the `እስከሆነ ድረስ` line as well would print it once, after the
   * loop, reading as though the loop ran at the end.
   */
  private trace(line: number, value: Value): void {
    this.onStatement?.(line, value, this.frames.length - 1);
  }

  private execute(statement: Statement, scope: Scope): Value {
    this.step(statement);
    this.frames[this.frames.length - 1] = {
      name: this.frames[this.frames.length - 1]?.name ?? GLOBAL_SCOPE_NAME,
      line: statement.line,
    };

    switch (statement.type) {
      case 'ExpressionStatement': {
        const value = this.evaluate(statement.expression, scope);
        this.trace(statement.line, value);
        return value;
      }

      case 'AssignmentStatement': {
        // The value is computed before the target is bound, so `ቆጣሪ = ቆጣሪ + 1`
        // in a function reads the outer one and creates a local (§7.1).
        const value = this.evaluate(statement.value, scope);
        this.assign(statement.target, value, scope);
        this.trace(statement.line, value);
        return NOTHING;
      }

      case 'TypedDeclaration':
        return this.declare(statement, scope);

      case 'ReturnStatement': {
        const value = statement.value === null ? NOTHING : this.evaluate(statement.value, scope);
        // Reported before unwinding, or a return would never appear in a
        // trace at all — and it is the most interesting line in a function.
        this.trace(statement.line, value);
        throw new ReturnSignal(value);
      }

      case 'IfStatement': {
        if (this.condition(statement.condition, scope)) {
          return this.executeBlock(statement.consequent, scope);
        }
        for (const branch of statement.elifs) {
          if (this.condition(branch.condition, scope)) {
            return this.executeBlock(branch.body, scope);
          }
        }
        if (statement.alternate !== null) {
          return this.executeBlock(statement.alternate, scope);
        }
        return NOTHING;
      }

      case 'WhileStatement': {
        while (this.condition(statement.condition, scope)) {
          this.executeBlock(statement.body, scope);
        }
        return NOTHING;
      }

      case 'FunctionDeclaration':
        scope.define(statement.name, this.makeFunction(statement, scope));
        this.trace(statement.line, NOTHING);
        return NOTHING;

      case 'ClassDeclaration':
        scope.define(statement.name, this.makeClass(statement, scope));
        this.trace(statement.line, NOTHING);
        return NOTHING;
    }
  }

  /** Evaluates a condition, which must be `እውነታ` — there is no truthiness (§4.4). */
  private condition(expression: Expression, scope: Scope): boolean {
    const value = this.evaluate(expression, scope);
    if (value.kind !== 'boolean') {
      this.fail(AH3005, expression, err.nonBooleanCondition(typeName(value)));
    }
    return value.value;
  }

  private declare(statement: TypedDeclaration, scope: Scope): Value {
    const value = this.evaluate(statement.value, scope);

    // A name already declared here keeps the type it was given: re-typing
    // shows up as a mismatch against the first annotation, which says more
    // than "declared twice" would (§7.2).
    const pinned = scope.hasOwn(statement.name) ? scope.declaredTypeOf(statement.name) : null;
    const effective: DeclaredType = pinned ?? statement.declaredType;

    if (!matchesDeclaredType(value, effective)) {
      this.fail(
        AH3009,
        statement.value,
        err.typeMismatch(statement.name, declaredTypeName(effective), typeName(value)),
      );
    }

    scope.pinType(statement.name, effective);
    scope.define(statement.name, value);
    this.trace(statement.line, value);
    return NOTHING;
  }

  // =========================================================================
  // Assignment (§7.1)
  // =========================================================================

  private assign(target: AssignTarget, value: Value, scope: Scope): void {
    if (target.type === 'Identifier') {
      this.assignName(target.name, value, scope, target);
      return;
    }

    if (target.type === 'MemberAccess') {
      const object = this.evaluate(target.object, scope);
      if (object.kind !== 'object') {
        this.fail(AH3014, target, err.noMembers(typeName(object)));
      }
      this.setAttribute(object, target.property, value, target);
      return;
    }

    // An index target. Strings cannot be changed in place; lists can (§6.5).
    const container = this.evaluate(target.target, scope);
    if (container.kind === 'string') {
      this.fail(AH3015, target);
    }
    if (container.kind !== 'list') {
      this.fail(AH3002, target, err.illegalUnary('መቀየር', typeName(container)));
    }

    const index = this.indexOf(target.index, container.items.length, scope, false);
    container.items[index] = value;
  }

  private assignName(name: string, value: Value, scope: Scope, at: Site): void {
    // Rebinding a name this scope already holds.
    if (scope.hasOwn(name)) {
      this.checkPinned(name, value, scope.declaredTypeOf(name), at);
      scope.define(name, value);
      return;
    }

    // Inside a method, a bare name that is one of the object's attributes
    // assigns the attribute — that is what makes `ስም = ስም_` work (§7.6).
    if (scope.self !== null && scope.self.attributes.has(name)) {
      this.setAttribute(scope.self, name, value, at);
      return;
    }

    // Otherwise a new local. Assignment never reaches up to rebind an outer
    // variable (§5.3), so no parent is consulted here.
    scope.define(name, value);
  }

  private setAttribute(object: ObjectValue, name: string, value: Value, at: Site): void {
    if (!object.attributes.has(name)) {
      this.fail(AH3012, at, err.undeclaredAttribute(name, object.cls.name));
    }
    this.checkPinned(name, value, object.attributeTypes.get(name) ?? null, at);
    object.attributes.set(name, value);
  }

  private checkPinned(name: string, value: Value, declared: DeclaredType | null, at: Site): void {
    if (declared === null) return;
    if (matchesDeclaredType(value, declared)) return;
    this.fail(AH3009, at, err.typeMismatch(name, declaredTypeName(declared), typeName(value)));
  }

  // =========================================================================
  // Expressions
  // =========================================================================

  evaluate(expression: Expression, scope: Scope): Value {
    this.step(expression);

    switch (expression.type) {
      case 'NumberLiteral':
        return num(expression.value);
      case 'StringLiteral':
        return str(expression.value);
      case 'BooleanLiteral':
        return bool(expression.value);
      case 'NothingLiteral':
        return NOTHING;

      case 'ListLiteral':
        return list(expression.elements.map((element) => this.evaluate(element, scope)));

      case 'Identifier': {
        const found = scope.resolve(expression.name);
        if (found === null) {
          this.fail(AH3001, expression, err.undefinedVariable(expression.name));
        }
        return found.value;
      }

      case 'MemberAccess': {
        const object = this.evaluate(expression.object, scope);
        if (object.kind !== 'object') {
          this.fail(AH3014, expression, err.noMembers(typeName(object)));
        }
        const attribute = object.attributes.get(expression.property);
        if (attribute !== undefined) return attribute;
        const method = findMethod(object, expression.property);
        if (method !== null) return method;
        this.fail(
          AH3012,
          expression,
          err.undeclaredAttribute(expression.property, object.cls.name),
        );
      }

      case 'IndexAccess': {
        const container = this.evaluate(expression.target, scope);
        if (container.kind === 'list') {
          const index = this.indexOf(expression.index, container.items.length, scope, false);
          return container.items[index] as Value;
        }
        if (container.kind === 'string') {
          const chars = codePoints(container.value);
          const index = this.indexOf(expression.index, chars.length, scope, false);
          return str(chars[index] as string);
        }
        this.fail(AH3002, expression, err.illegalUnary('ቦታ መምረጥ', typeName(container)));
      }

      case 'SliceAccess':
        return this.slice(expression, scope);

      case 'CallExpression': {
        const callee = this.evaluate(expression.callee, scope);
        const args = expression.args.map((argument) => this.evaluate(argument, scope));
        return this.call(callee, args, expression);
      }

      case 'UnaryExpression':
        return this.unary(expression, scope);

      case 'BinaryExpression':
        return this.binary(expression, scope);

      case 'InvalidExpression':
        // Unreachable: a program with parse diagnostics is never run (§9.3).
        this.fail(AH3002, expression, 'ያልተነበበ ዋጋ');
    }
  }

  // =========================================================================
  // Indexing and slicing (§6.5)
  // =========================================================================

  /**
   * Resolves an index expression against a length.
   *
   * A negative index counts from the end, so the effective index is
   * `i < 0 ? n + i : i`, stated outright rather than borrowed from the host
   * language — v1-py leaned on Python's negative indexing while bounds-checking
   * the absolute value, and so rejected `x[-n]` while accepting `x[-1]`
   * (CHANGES C27).
   */
  private indexOf(expression: Expression, length: number, scope: Scope, clamp: boolean): number {
    const value = this.evaluate(expression, scope);
    if (value.kind !== 'number') {
      this.fail(AH3007, expression, err.nonIntegerIndex(typeName(value)));
    }
    if (!Number.isInteger(value.value)) {
      this.fail(AH3007, expression, err.nonIntegerIndex(render(value)));
    }

    const effective = value.value < 0 ? length + value.value : value.value;
    if (clamp) return Math.max(0, Math.min(length, effective));
    if (effective < 0 || effective >= length) {
      this.fail(AH3008, expression, err.indexOutOfRange(value.value, length));
    }
    return effective;
  }

  /**
   * `x[a:b]` — from `a` inclusive to `b` exclusive, defaulting to `0` and
   * **`n`**, so `x[:]` is a full copy. v1-py defaulted the end to `n-1` and
   * silently dropped the last element (CHANGES C16).
   *
   * Slice bounds clamp, so slicing never fails on range.
   */
  private slice(expression: Extract<Expression, { type: 'SliceAccess' }>, scope: Scope): Value {
    const container = this.evaluate(expression.target, scope);

    const length =
      container.kind === 'list'
        ? container.items.length
        : container.kind === 'string'
          ? stringLength(container.value)
          : this.fail(AH3002, expression, err.illegalUnary('ማቁረጥ', typeName(container)));

    const from = expression.from === null ? 0 : this.indexOf(expression.from, length, scope, true);
    const to = expression.to === null ? length : this.indexOf(expression.to, length, scope, true);
    const end = Math.max(from, to);

    if (container.kind === 'list') return list(container.items.slice(from, end));
    return str(
      codePoints((container as StringValue).value)
        .slice(from, end)
        .join(''),
    );
  }

  // =========================================================================
  // Operators (§6.2)
  // =========================================================================

  private unary(expression: UnaryExpression, scope: Scope): Value {
    const operand = this.evaluate(expression.operand, scope);

    if (expression.operator === 'NEG') {
      if (operand.kind !== 'number') {
        this.fail(
          AH3002,
          expression,
          err.illegalUnary(OPERATION_NAMES.NEG as string, typeName(operand)),
        );
      }
      return num(-operand.value);
    }

    if (operand.kind !== 'boolean') {
      this.fail(AH3002, expression, err.nonBooleanOperand('ተቃርኖ', typeName(operand)));
    }
    return bool(!operand.value);
  }

  private binary(expression: BinaryExpression, scope: Scope): Value {
    const { operator } = expression;

    // `እና` and `ወይም` short-circuit, so the right operand is neither evaluated
    // nor type-checked when the left settles the answer (§6.2).
    if (operator === 'AND' || operator === 'OR') {
      const left = this.booleanOperand(expression.left, operator, scope);
      if (operator === 'AND' && !left) return bool(false);
      if (operator === 'OR' && left) return bool(true);
      return bool(this.booleanOperand(expression.right, operator, scope));
    }

    const left = this.evaluate(expression.left, scope);
    const right = this.evaluate(expression.right, scope);

    if (operator === 'EQ') return bool(valuesEqual(left, right));
    if (operator === 'NEQ') return bool(!valuesEqual(left, right));

    if (left.kind === 'number' && right.kind === 'number') {
      return this.numeric(operator, left.value, right.value, expression);
    }

    if (operator === 'ADD' && left.kind === 'string' && right.kind === 'string') {
      return str(left.value + right.value);
    }
    if (operator === 'ADD' && left.kind === 'list' && right.kind === 'list') {
      // Concatenation into a new list. v1-py appended the right operand as a
      // single element, so `[1] + [2]` gave `[1, [2]]` (CHANGES C15).
      return list([...left.items, ...right.items]);
    }
    if (operator === 'MUL' && left.kind === 'string') {
      return this.repeat(left.value, right, expression);
    }

    if (left.kind === 'string' && right.kind === 'string') {
      const order = compareStrings(left.value, right.value);
      const compared = this.order(operator, order);
      if (compared !== null) return bool(compared);
    }

    this.fail(
      AH3002,
      expression,
      err.illegalBinary(OPERATION_NAMES[operator] ?? operator, typeName(left), typeName(right)),
    );
  }

  private booleanOperand(expression: Expression, operation: string, scope: Scope): boolean {
    const value = this.evaluate(expression, scope);
    if (value.kind !== 'boolean') {
      this.fail(
        AH3002,
        expression,
        err.nonBooleanOperand(operation === 'AND' ? 'እና' : 'ወይም', typeName(value)),
      );
    }
    return value.value;
  }

  /** Maps a comparison operator onto a three-way ordering, or null if it is not one. */
  private order(operator: string, ordering: number): boolean | null {
    switch (operator) {
      case 'LT':
        return ordering < 0;
      case 'LTE':
        return ordering <= 0;
      case 'GT':
        return ordering > 0;
      case 'GTE':
        return ordering >= 0;
      default:
        return null;
    }
  }

  private numeric(operator: string, a: number, b: number, at: Site): Value {
    const compared = this.order(operator, a === b ? 0 : a < b ? -1 : 1);
    if (compared !== null) return bool(compared);

    switch (operator) {
      case 'ADD':
        return this.finite(a + b, at);
      case 'SUB':
        return this.finite(a - b, at);
      case 'MUL':
        return this.finite(a * b, at);
      case 'DIV':
        if (b === 0) this.fail(AH3003, at, err.divisionByZero('DIV'));
        return this.finite(a / b, at);
      case 'MOD':
        if (b === 0) this.fail(AH3003, at, err.divisionByZero('MOD'));
        // JavaScript's % already takes the sign of the left operand (§6.2).
        return this.finite(a % b, at);
      case 'POW': {
        // A negative base with a fractional exponent has no real result, and
        // v1-py quietly returned a complex number for it (CHANGES C38).
        if (a < 0 && !Number.isInteger(b)) {
          this.fail(AH3004, at, err.undefinedPower(a, b));
        }
        return this.finite(a ** b, at);
      }
      default:
        return this.fail(AH3002, at, OPERATION_NAMES[operator] ?? operator);
    }
  }

  /** `NaN` and `±Infinity` are not reachable values: every route to one errors (§4.2). */
  private finite(value: number, at: Site): Value {
    if (!Number.isFinite(value)) this.fail(AH3006, at, err.OVERFLOW);
    return num(value);
  }

  private repeat(text: string, count: Value, at: Site): Value {
    if (count.kind !== 'number' || !Number.isInteger(count.value) || count.value < 0) {
      this.fail(
        AH3002,
        at,
        err.repeatCount(count.kind === 'number' ? render(count) : typeName(count)),
      );
    }
    const result = text.repeat(count.value);
    if (result.length > 1e7) this.fail(AH3006, at, err.OVERFLOW);
    return str(result);
  }

  // =========================================================================
  // Functions (§7.5)
  // =========================================================================

  private makeFunction(declaration: FunctionDeclaration, scope: Scope): Value {
    return {
      kind: 'function',
      name: declaration.name,
      params: declaration.params,
      body: declaration.body,
      closure: scope,
      boundTo: null,
    };
  }

  /** Calls a function, a built-in, or a class (which constructs). */
  call(callee: Value, args: readonly Value[], at: Site): Value {
    if (callee.kind === 'builtin') return callee.call(args, at);
    if (callee.kind === 'class') return this.construct(callee, args, at);

    if (callee.kind !== 'function') {
      this.fail(AH3013, at, err.notCallable(typeName(callee)));
    }

    if (args.length !== callee.params.length) {
      this.fail(AH3010, at, err.argumentCount(callee.name, callee.params.length, args.length));
    }

    const scope = callee.closure.child(callee.name, callee.boundTo);
    callee.params.forEach((param, i) => {
      scope.define(param, args[i] as Value);
    });

    return this.invoke(callee.name, callee.body, scope, at);
  }

  /** Runs a body with a frame pushed, catching the `ተመላሽ` that leaves it. */
  private invoke(name: string, body: Block, scope: Scope, at: Site): Value {
    if (this.frames.length >= this.maxDepth) {
      this.fail(AH3017, at, err.callDepthExceeded(this.maxDepth));
    }

    this.frames.push({ name, line: at.line });
    try {
      this.executeBlock(body, scope);
      // Falling off the end returns ምንም (§7.5).
      return NOTHING;
    } catch (signal) {
      if (signal instanceof ReturnSignal) return signal.value;
      throw signal;
    } finally {
      this.frames.pop();
    }
  }

  // =========================================================================
  // Classes (§7.6)
  // =========================================================================

  private makeClass(declaration: ClassDeclaration, scope: Scope): Value {
    let parent: ClassValue | null = null;
    if (declaration.parent !== null) {
      const found = scope.get(declaration.parent);
      if (found === null || found.kind !== 'class') {
        this.fail(AH3011, declaration, err.unknownParent(declaration.parent));
      }
      parent = found;
    }

    const methods = new Map<string, FunctionDeclaration>();
    for (const method of declaration.methods) methods.set(method.name, method);

    return {
      kind: 'class',
      name: declaration.name,
      parent,
      attributes: declaration.attributes,
      constructorDeclaration: declaration.constructor,
      methods,
      scope,
    };
  }

  /** The attribute declarations of a class chain, from the root down (§7.6). */
  private attributeChain(
    cls: ClassValue,
  ): { cls: ClassValue; declaration: AttributeDeclaration }[] {
    const chain: ClassValue[] = [];
    for (let current: ClassValue | null = cls; current !== null; current = current.parent) {
      chain.unshift(current);
    }
    return chain.flatMap((owner) =>
      owner.attributes.map((declaration) => ({ cls: owner, declaration })),
    );
  }

  private construct(cls: ClassValue, args: readonly Value[], at: Site): Value {
    const attributes = new Map<string, Value>();
    const attributeTypes = new Map<string, DeclaredType>();

    // Defaults are evaluated afresh for each object, in the scope the class
    // was declared in. Evaluating them once at declaration would give every
    // object of the class the same list (§7.6).
    for (const { cls: owner, declaration } of this.attributeChain(cls)) {
      attributes.set(declaration.name, this.evaluate(declaration.value, owner.scope));
      if (declaration.declaredType !== null) {
        attributeTypes.set(declaration.name, declaration.declaredType);
      } else {
        attributeTypes.delete(declaration.name);
      }
    }

    const object: ObjectValue = { kind: 'object', cls, attributes, attributeTypes };

    // A class with no ፍጠር inherits its parent's (§7.6).
    let owner: ClassValue | null = cls;
    while (owner !== null && owner.constructorDeclaration === null) owner = owner.parent;

    if (owner === null) {
      if (args.length > 0) this.fail(AH3010, at, err.argumentCount(cls.name, 0, args.length));
      return object;
    }

    const declaration = owner.constructorDeclaration as NonNullable<
      ClassValue['constructorDeclaration']
    >;
    if (args.length !== declaration.params.length) {
      this.fail(AH3010, at, err.argumentCount(cls.name, declaration.params.length, args.length));
    }

    const scope = owner.scope.child(`${cls.name}.ፍጠር`, object);
    declaration.params.forEach((param, i) => {
      scope.define(param, args[i] as Value);
    });

    this.invoke(`${cls.name}.ፍጠር`, declaration.body, scope, at);
    return object;
  }
}

// ===========================================================================
// Built-in functions (§8)
// ===========================================================================

/**
 * The seven globals.
 *
 * They are ordinary bindings, not keywords, so user code may shadow them.
 * v1-py made `ጻፍ`, `አዋህድ` and `ሰርዝ` keywords and then implemented only the
 * first, so calling either other one crashed the interpreter (CHANGES C13).
 *
 * `አዋህድ` and `ሰርዝ` are imperatives in Amharic, so they change the list they
 * are given and return `ምንም`: `ዝ = አዋህድ(ዝ፣ 4)` then leaves `ዝ` holding
 * `ምንም`, which fails loudly instead of looking like it worked (§4.5).
 */
function createBuiltins(interpreter: Interpreter): Map<string, Value> {
  const builtins = new Map<string, Value>();

  const define = (name: string, call: (args: readonly Value[], at: Site) => Value): void => {
    builtins.set(name, { kind: 'builtin', name, call });
  };

  /** Checks arity for a built-in that takes a fixed number of arguments. */
  const arity = (name: string, args: readonly Value[], expected: number, at: Site): void => {
    if (args.length !== expected) {
      interpreter.fail(AH3010, at, err.argumentCount(name, expected, args.length));
    }
  };

  const expectList = (name: string, args: readonly Value[], at: Site): ListValue => {
    const value = args[0] as Value;
    if (value.kind !== 'list') {
      interpreter.fail(AH3002, at, err.illegalUnary(`"${name}"`, typeName(value)));
    }
    return value;
  };

  define('ጻፍ', (args, _at) => {
    interpreter.host.write(`${args.map((value) => render(value)).join(' ')}\n`);
    return NOTHING;
  });

  define('ርዝመት', (args, at) => {
    arity('ርዝመት', args, 1, at);
    const value = args[0] as Value;
    if (value.kind === 'string') return num(stringLength(value.value));
    if (value.kind === 'list') return num(value.items.length);
    interpreter.fail(AH3002, at, err.illegalUnary('"ርዝመት"', typeName(value)));
  });

  define('አዋህድ', (args, at) => {
    arity('አዋህድ', args, 2, at);
    expectList('አዋህድ', args, at).items.push(args[1] as Value);
    return NOTHING;
  });

  define('ሰርዝ', (args, at) => {
    arity('ሰርዝ', args, 2, at);
    const target = expectList('ሰርዝ', args, at);
    const index = args[1] as Value;
    if (index.kind !== 'number' || !Number.isInteger(index.value)) {
      interpreter.fail(AH3007, at, err.nonIntegerIndex(typeName(index)));
    }
    const effective = index.value < 0 ? target.items.length + index.value : index.value;
    if (effective < 0 || effective >= target.items.length) {
      interpreter.fail(AH3008, at, err.indexOutOfRange(index.value, target.items.length));
    }
    target.items.splice(effective, 1);
    return NOTHING;
  });

  define('ቅጂ', (args, at) => {
    arity('ቅጂ', args, 1, at);
    // Shallow: a nested list is still shared (§4.5).
    return list([...expectList('ቅጂ', args, at).items]);
  });

  define('አይነት', (args, at) => {
    arity('አይነት', args, 1, at);
    return str(typeName(args[0] as Value));
  });

  define('አንብብ', (args, at) => {
    if (args.length > 1) {
      interpreter.fail(AH3010, at, err.argumentCount('አንብብ', 1, args.length));
    }
    const prompt = args.length === 1 ? render(args[0] as Value) : null;
    return str(interpreter.host.readLine(prompt));
  });

  return builtins;
}

// ===========================================================================
// Entry point
// ===========================================================================

/**
 * Runs a program.
 *
 * Stops at the first runtime error and hands it back with the call stack as it
 * stood; 2.0 has no exception handling (§9.3). Never throws.
 */
export function run(program: Program, host: Host, options: RunOptions = {}): RunResult {
  return new Interpreter(host, options).tryRun(program);
}
