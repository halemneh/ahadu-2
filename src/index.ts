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

export { tokenize } from './lexer/index.js';
export type { KeywordType, LexResult, Token, TokenType } from './lexer/index.js';
export { describeToken, isKeyword } from './lexer/index.js';

export type { Diagnostic, Stage } from './diagnostics.js';
export { formatDiagnostic, sortDiagnostics } from './diagnostics.js';

export { parse, printAst } from './parser/index.js';
export type {
  Block,
  Expression,
  Node,
  ParseResult,
  Program,
  Span,
  Statement,
} from './parser/index.js';

// Stage exports are added as each stage lands:
//   export { run } from './interpreter/index.js';
