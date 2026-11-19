/**
 * The interpreter stage (LANGUAGE.md §4–9).
 *
 * `run` takes a parsed program and a `Host` for I/O, and returns the value of
 * the last statement plus the first runtime error, if any. It never throws:
 * runaway recursion and endless loops come back as `AH3017` and `AH3018`
 * rather than taking the host down.
 */

export { Interpreter, run, GLOBAL_SCOPE_NAME } from './interpreter.js';
export type { Host, RunOptions, RunResult } from './interpreter.js';
export { AhaduError, ReturnSignal } from './errors.js';
export type { Frame } from './errors.js';
export { Scope, findMethod } from './scope.js';
export * from './values.js';
