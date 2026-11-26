/**
 * Runtime values (LANGUAGE.md §4) and how they print (§8.1).
 *
 * Nine kinds, in a discriminated union, so the evaluator switches on `kind`
 * and the compiler checks every case is handled. Strings are immutable;
 * lists and objects are mutable references (§4.3, §4.5, §4.7).
 */

import type {
  AttributeDeclaration,
  Block,
  ConstructorDeclaration,
  DeclaredType,
  FunctionDeclaration,
} from '../parser/index.js';
import type { Scope } from './scope.js';

export interface NumberValue {
  readonly kind: 'number';
  readonly value: number;
}

export interface BooleanValue {
  readonly kind: 'boolean';
  readonly value: boolean;
}

export interface StringValue {
  readonly kind: 'string';
  readonly value: string;
}

/** Mutable, and held by reference: two names can mean one list (§4.5). */
export interface ListValue {
  readonly kind: 'list';
  readonly items: Value[];
}

export interface NothingValue {
  readonly kind: 'nothing';
}

export interface FunctionValue {
  readonly kind: 'function';
  readonly name: string;
  readonly params: readonly string[];
  readonly body: Block;
  /** The scope the function was declared in — closures are lexical (§5.3). */
  readonly closure: Scope;
  /** Set when the function was reached through an object, so `አበበ.ደረጃ` is callable (§7.6). */
  readonly boundTo: ObjectValue | null;
  /**
   * Set when the function was declared by the standard library's prelude
   * rather than by the program being run (§8.5).
   *
   * Provenance, not a name: a learner who writes their own `ተግባር ደምር` must
   * not have errors inside it reattributed as if it were library code.
   */
  readonly fromLibrary?: true;
}

export interface BuiltinValue {
  readonly kind: 'builtin';
  readonly name: string;
  readonly call: (args: readonly Value[], at: Site) => Value;
}

export interface ClassValue {
  readonly kind: 'class';
  readonly name: string;
  readonly parent: ClassValue | null;
  readonly attributes: readonly AttributeDeclaration[];
  readonly constructorDeclaration: ConstructorDeclaration | null;
  readonly methods: ReadonlyMap<string, FunctionDeclaration>;
  /** Where the class was declared: attribute defaults evaluate here (§7.6). */
  readonly scope: Scope;
  /**
   * Set when the class was declared by the standard library's prelude (§8.5).
   *
   * Methods are built from the declaration on demand by `findMethod`, which
   * never goes through `makeFunction` — so without this the provenance that
   * reattributes a library error would reach every library *function* and no
   * library *method*.
   */
  readonly fromLibrary?: true;
}

export interface ObjectValue {
  readonly kind: 'object';
  readonly cls: ClassValue;
  /** Fixed at construction from the whole class chain; objects do not grow (§7.6). */
  readonly attributes: Map<string, Value>;
  /** Types pinned by annotated attribute declarations (§7.2). */
  readonly attributeTypes: ReadonlyMap<string, DeclaredType>;
}

export type Value =
  | NumberValue
  | BooleanValue
  | StringValue
  | ListValue
  | NothingValue
  | FunctionValue
  | BuiltinValue
  | ClassValue
  | ObjectValue;

/** Where something happened, for diagnostics and tracebacks. */
export interface Site {
  readonly line: number;
  readonly startCol: number;
  readonly endCol: number;
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export const NOTHING: NothingValue = { kind: 'nothing' };
export const TRUE: BooleanValue = { kind: 'boolean', value: true };
export const FALSE: BooleanValue = { kind: 'boolean', value: false };

export function num(value: number): NumberValue {
  return { kind: 'number', value };
}

export function bool(value: boolean): BooleanValue {
  return value ? TRUE : FALSE;
}

export function str(value: string): StringValue {
  return { kind: 'string', value };
}

export function list(items: Value[]): ListValue {
  return { kind: 'list', items };
}

// ---------------------------------------------------------------------------
// Type names (§4.1)
// ---------------------------------------------------------------------------

/** The Amharic name of a value's type, which is what `አይነት` returns. */
export function typeName(value: Value): string {
  switch (value.kind) {
    case 'number':
      return 'ቁጥር';
    case 'boolean':
      return 'እውነታ';
    case 'string':
      return 'ጽሁፍ';
    case 'list':
      return 'ስብስብ';
    case 'nothing':
      return 'ምንም';
    case 'function':
    case 'builtin':
      return 'ተግባር';
    case 'class':
      return 'ክላስ';
    case 'object':
      return 'ኦብጀክት';
  }
}

/** The Amharic name of an annotation's type (§7.2). */
export function declaredTypeName(type: DeclaredType): string {
  switch (type) {
    case 'NUMBER':
      return 'ቁጥር';
    case 'BOOLEAN':
      return 'እውነታ';
    case 'STRING':
      return 'ጽሁፍ';
    case 'LIST':
      return 'ስብስብ';
  }
}

/** Whether a value satisfies a type annotation (§7.2). */
export function matchesDeclaredType(value: Value, type: DeclaredType): boolean {
  switch (type) {
    case 'NUMBER':
      return value.kind === 'number';
    case 'BOOLEAN':
      return value.kind === 'boolean';
    case 'STRING':
      return value.kind === 'string';
    case 'LIST':
      return value.kind === 'list';
  }
}

// ---------------------------------------------------------------------------
// Strings as code points (§4.3)
// ---------------------------------------------------------------------------

/**
 * Splits a string into code points.
 *
 * Every Ethiopic code point is in the BMP, so for Ahadu source the fast path
 * is the one that runs: a string with no surrogate pair is already one UTF-16
 * unit per code point, and splitting it is only needed when some astral
 * character — an emoji, say — is present.
 */
export function codePoints(text: string): readonly string[] {
  // The last answer is kept, because the common caller is a loop indexing
  // one string — `ጽሁፍ[ቆ]` with `ቆ` counting up — and re-splitting the whole
  // string for every character made walking it quadratic: 17 seconds for
  // 40,000 characters. Callers never change the array they are given.
  if (text === lastText) return lastPoints;
  lastPoints = /[\uD800-\uDFFF]/.test(text) ? Array.from(text) : text.split('');
  lastText = text;
  return lastPoints;
}

let lastText: string | null = null;
let lastPoints: readonly string[] = [];

/** A string's length in code points, which is what `ርዝመት` reports. */
export function stringLength(text: string): number {
  if (!/[\uD800-\uDFFF]/.test(text)) return text.length;
  return Array.from(text).length;
}

/**
 * Compares two strings by code point (§6.2).
 *
 * JavaScript's own `<` compares UTF-16 code units, which puts some astral
 * characters before BMP ones they should follow. Ethiopic is unaffected, but
 * the spec says code points, so this does code points.
 */
export function compareStrings(a: string, b: string): number {
  const left = codePoints(a);
  const right = codePoints(b);
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    const x = (left[i] as string).codePointAt(0) ?? 0;
    const y = (right[i] as string).codePointAt(0) ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Equality (§6.3)
// ---------------------------------------------------------------------------

/**
 * Structural equality.
 *
 * Values of different types are not equal — and that is not an error, because
 * "are these the same?" is a fair question to ask of any two values (§6.3).
 * Lists compare element-wise even though they are mutable references; objects
 * and functions compare by identity.
 */
export function valuesEqual(a: Value, b: Value, comparing?: Map<object, Set<object>>): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'number':
      return a.value === (b as NumberValue).value;
    case 'boolean':
      return a.value === (b as BooleanValue).value;
    case 'string':
      return a.value === (b as StringValue).value;
    case 'nothing':
      return true;
    case 'list': {
      const other = b as ListValue;
      if (a.items.length !== other.items.length) return false;
      // A list can contain itself (`ጨምር(ሀ፣ ሀ)`). A pair already being
      // compared further up is assumed equal, so the comparison ends instead
      // of recursing until the host's stack gives out.
      const pairs = comparing ?? new Map<object, Set<object>>();
      const against = pairs.get(a) ?? new Set<object>();
      if (against.has(other)) return true;
      against.add(other);
      pairs.set(a, against);
      return a.items.every((item, i) => valuesEqual(item, other.items[i] as Value, pairs));
    }
    default:
      return a === b;
  }
}

// ---------------------------------------------------------------------------
// Rendering (§8.1)
// ---------------------------------------------------------------------------

/**
 * Renders a number.
 *
 * A value that is mathematically an integer prints with no decimal point, so
 * `4 / 2` shows `2` rather than `2.0` — for an audience learning what
 * division is, the trailing zero is noise (§4.2, CHANGES C30).
 */
function renderNumber(value: number): string {
  if (Object.is(value, -0)) return '0';
  return plainDecimal(String(value));
}

/**
 * JavaScript's shortest round-trip digits, written out without an exponent.
 *
 * `String(10 ** 21)` is `1e+21` and `String(1e-7)` is `1e-7`, and Ahadu has
 * no exponent literal — so `ወደ_ቁጥር(ወደ_ጽሁፍ(10 ^ 21))` was AH3019, breaking
 * §8.1's one rendering that reads back. The digits are the same; only the
 * point moves.
 */
export function plainDecimal(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
  if (match === null) return text;
  const [, sign = '', whole = '', fraction = '', exponentText = '0'] = match;
  const digits = whole + fraction;
  const point = whole.length + Number(exponentText);
  let out: string;
  if (point <= 0) out = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length);
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return sign + out.replace(/^0+(?=\d)/, '');
}

/**
 * Renders a value the way `ጻፍ` shows it (§8.1).
 *
 * `nested` is set for a value inside a list, which is the only place a string
 * is quoted: `ጻፍ(["ሀ"])` shows `["ሀ"]` while `ጻፍ("ሀ")` shows `ሀ`.
 */
export function render(value: Value, nested = false, open = new Set<object>()): string {
  switch (value.kind) {
    case 'number':
      return renderNumber(value.value);
    case 'boolean':
      return value.value ? 'እውነት' : 'ሃሰት';
    case 'string':
      return nested ? `"${value.value}"` : value.value;
    case 'nothing':
      return 'ምንም';
    case 'list': {
      // A list that contains itself prints as `[…]` where it recurs (§8.1),
      // rather than recursing until the host's stack gives out.
      if (open.has(value)) return '[…]';
      open.add(value);
      const text = `[${value.items.map((item) => render(item, true, open)).join('፣ ')}]`;
      open.delete(value);
      return text;
    }
    case 'function':
    case 'builtin':
      return `[ተግባር ${value.name}]`;
    case 'class':
      return `[ክላስ ${value.name}]`;
    case 'object':
      return `[${value.cls.name} ኦብጀክት]`;
  }
}

/** Whether a value can be called (§7.5, §7.6). */
export function isCallable(value: Value): boolean {
  return value.kind === 'function' || value.kind === 'builtin' || value.kind === 'class';
}
