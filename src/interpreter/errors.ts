/**
 * Runtime errors and the signals the evaluator throws (LANGUAGE.md §9).
 *
 * Two things travel by exception:
 *
 * - `AhaduError`, a runtime error, carrying its diagnostic and the call stack
 *   as it stood. `run` catches it at the top and hands it back; nothing
 *   escapes into the host.
 * - `ReturnSignal`, which is how `ተመላሽ` leaves a function from wherever it
 *   is. v1-py instead decided once, syntactically, whether a function
 *   returned — so an early return was computed and discarded, and a return
 *   inside a loop did not even end the loop (CHANGES C17).
 */

import type { Diagnostic } from '../diagnostics.js';
import { diagnostic } from '../diagnostics.js';
import type { Site, Value } from './values.js';

/** A frame in the call stack, for the traceback (§9.1). */
export interface Frame {
  /** The function or scope name, with the global one called `ዋና ፕሮግራም`. */
  readonly name: string;
  /** The line the call was made from. */
  readonly line: number;
}

export class AhaduError extends Error {
  constructor(
    readonly diagnosticValue: Diagnostic,
    readonly frames: readonly Frame[],
  ) {
    super(`${diagnosticValue.code}: ${diagnosticValue.message}`);
    this.name = 'AhaduError';
  }
}

/**
 * `ተመላሽ` unwinding to the call that is running the function (§7.5).
 *
 * An Error subclass because it travels by `throw`, not because anything went
 * wrong: this is how a return leaves a loop or a nested block at all.
 */
export class ReturnSignal extends Error {
  constructor(readonly value: Value) {
    super('ተመላሽ');
    this.name = 'ReturnSignal';
  }
}

/** Builds a runtime diagnostic at a site. */
export function runtimeDiagnostic(code: string, at: Site, message?: string): Diagnostic {
  return diagnostic(code, 'runtime', at.line, at.startCol, at.endCol, message);
}

// ---------------------------------------------------------------------------
// Message text (§9)
// ---------------------------------------------------------------------------

export function undefinedVariable(name: string): string {
  return `"${name}" የሚባል ተለዋጭ አልተገለጸም።`;
}

/** The message for an operator applied to types it does not accept (§6.2). */
export function illegalBinary(operation: string, left: string, right: string): string {
  return `${left} እና ${right}ን ${operation} አይቻልም።`;
}

export function illegalUnary(operation: string, operand: string): string {
  return `${operand} ${operation}ን አይፈቅድም።`;
}

export function nonBooleanCondition(found: string): string {
  return `ሁኔታው እውነት ወይም ሃሰት መሆን አለበት፤ ${found} ተገኝቷል።`;
}

export function nonBooleanOperand(operation: string, found: string): string {
  return `"${operation}" እውነት ወይም ሃሰት ይጠብቃል፤ ${found} ተገኝቷል።`;
}

export function nonIntegerIndex(found: string): string {
  return `የቦታ ቁጥር ሙሉ ቁጥር መሆን አለበት፤ ${found} ተገኝቷል።`;
}

export function indexOutOfRange(index: number, length: number): string {
  return `${index} ከስብስቡ ውጪ ነው። ርዝመቱ ${length} ነው።`;
}

export function typeMismatch(name: string, declared: string, found: string): string {
  return `"${name}" ${declared} ነው፤ ${found} መስጠት አይቻልም።`;
}

export function argumentCount(name: string, expected: number, got: number): string {
  return `"${name}" ${expected} ግቤት ይጠብቃል፤ ${got} ተሰጥቷል።`;
}

export function unknownParent(name: string): string {
  return `"${name}" የሚባል ክላስ አልተገለጸም።`;
}

export function undeclaredAttribute(name: string, className: string): string {
  return `"${className}" "${name}" የሚባል ባህሪ የለውም። ባህሪዎች በክላሱ ውስጥ መገለጽ አለባቸው።`;
}

export function notCallable(found: string): string {
  return `${found} ሊጠራ አይችልም።`;
}

export function noMembers(found: string): string {
  return `${found} ባህሪ የለውም።`;
}

export function divisionByZero(operation: string): string {
  return operation === 'MOD' ? 'በዘሮ ቀሪ ማግኘት አይቻልም።' : 'በዘሮ ማካፈል አይቻልም።';
}

export function undefinedPower(base: number, exponent: number): string {
  return `${base} በ${exponent} ፓወር ማስላት አይቻልም።`;
}

export const OVERFLOW = 'ውጤቱ ከቁጥር መጠን አለፈ።';

export function repeatCount(found: string): string {
  return `ጽሁፍን ለማባዛት ከዜሮ የማያንስ ሙሉ ቁጥር ያስፈልጋል፤ ${found} ተገኝቷል።`;
}

export function callDepthExceeded(limit: number): string {
  return `የጥሪ ጥልቀት ${limit} አለፈ። ድግግሞሹ መቆሚያ አለው?`;
}

export function stepLimitExceeded(limit: number): string {
  return `ፕሮግራሙ ${limit} እርምጃ አለፈ። ዑደቱ መቆሚያ አለው?`;
}

/**
 * The message for `ወደቁጥር` on text that is not a number (§8).
 *
 * The text is quoted back, because the usual cause is invisible: a space, a
 * `፡` typed for a colon, or an empty prompt someone pressed Enter through.
 */
export function notNumericText(text: string): string {
  // Pressing Enter at a prompt is the commonest way to land here, and
  // `"" ቁጥር አይደለም።` shows a learner nothing at all.
  if (text.trim().length === 0) return 'ምንም አልተጻፈም፤ ቁጥር ያስፈልጋል።';
  return `"${text}" ቁጥር አይደለም።`;
}

/** The message for `አጋጣሚ` given bounds it cannot draw from (§8). */
export function badRandomRange(low: string, high: string): string {
  return `አጋጣሚ ከ${low} እስከ ${high} መምረጥ አይችልም፤ ሁለቱም ሙሉ ቁጥር መሆን አለባቸው እና መጀመሪያው ከመጨረሻው መብለጥ አይችልም።`;
}

/**
 * The message for calling a name that used to be a built-in (§8, AH3013).
 *
 * Built-ins are ordinary shadowable bindings, and several are nouns —
 * `ርዝመት`, `ቅጂ`, `አይነት`, `ዘር` — so assigning to one by accident is easy and
 * the consequence appears at the *next* call, somewhere else entirely. Naming
 * the cause is the difference between a two-second fix and a mystery.
 */
export function shadowedBuiltin(name: string, found: string): string {
  return `"${name}" የአሃዱ ተግባር ነበር፤ ዋጋ ስለሰጡት አሁን ${found} ነው — ሊጠራ አይችልም። ለተለዋጩ ሌላ ስም ይስጡት።`;
}
