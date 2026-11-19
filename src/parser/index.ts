/**
 * The parser stage (LANGUAGE.md §5–7).
 *
 * `parse` takes the lexer's tokens and returns a `Program` plus every problem
 * it found. It never throws, and it always returns a program, so an editor can
 * keep working on a file that is halfway typed (§9.3).
 */

export { parse } from './parser.js';
export type { ParseResult } from './parser.js';
export * from './ast.js';
export { outlineAst, printAst } from './print.js';
export type { AstRow } from './print.js';
