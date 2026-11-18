/**
 * Ahadu 2.0 — public entry point.
 *
 * The language this implements is specified in `spec/LANGUAGE.md`, which is
 * normative: where this code and that document disagree, this code is wrong.
 *
 * Pipeline: source → `lexer` → tokens → `parser` → AST → `interpreter` → value.
 * Each stage is independently importable so tooling can stop at any of them
 * (see `spec/TOOLING.md`).
 */

export const VERSION = '2.0.0';

// Stage exports are added as each stage lands:
//   export { tokenize } from './lexer/index.js';
//   export { parse } from './parser/index.js';
//   export { run } from './interpreter/index.js';
