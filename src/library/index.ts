/**
 * Loading the standard library into an interpreter (LANGUAGE.md §8.5).
 *
 * The library is Ahadu source, so it has to be lexed and parsed, which the
 * interpreter cannot do — it holds no reference to the parser at runtime, and
 * should not acquire one just to bootstrap its own globals. So this module
 * sits above both, and `src/engine.ts` is what hosts actually call.
 *
 * The prelude runs as its **own program** through the same `Interpreter`,
 * which is the whole reason this design works: `tryRun` resets the step
 * counter and reports against the program it was given, so the learner's
 * diagnostics carry the learner's line numbers with no offset mechanism
 * anywhere, and the prelude's own steps never come out of their budget. The
 * REPL has driven one long-lived interpreter with repeated `tryRun` calls
 * since M4, so this is an established pattern rather than a new capability.
 */

import { tokenize } from '../lexer/index.js';
import { parse } from '../parser/index.js';
import type { Program } from '../parser/index.js';
import type { Interpreter } from '../interpreter/index.js';
import { LIBRARY_NAMES, LIBRARY_SOURCE } from './source.js';

export { LIBRARY_NAMES, LIBRARY_SOURCE };

/** Parsed once per process; the source is a constant, so it cannot change. */
let parsed: Program | null = null;

/**
 * The library as a parsed program.
 *
 * Throws if the library itself does not lex and parse. That is deliberate and
 * it is not defensive programming: a broken prelude is a bug in this
 * repository, not a problem with anyone's program, and it must not surface as
 * a confusing diagnostic against a learner's file. A test parses it too, so
 * this throw is a backstop rather than the thing that catches it.
 */
export function libraryProgram(): Program {
  if (parsed !== null) return parsed;

  const lexed = tokenize(LIBRARY_SOURCE);
  if (lexed.diagnostics.length > 0) {
    throw new Error(`the standard library does not lex: ${describe(lexed.diagnostics)}`);
  }

  const result = parse(lexed.tokens);
  if (result.diagnostics.length > 0) {
    throw new Error(`the standard library does not parse: ${describe(result.diagnostics)}`);
  }

  parsed = result.program;
  return parsed;
}

function describe(diagnostics: readonly { code: string; line: number; message: string }[]): string {
  return diagnostics.map((d) => `${d.code} at line ${d.line}: ${d.message}`).join('; ');
}

/**
 * Runs the prelude in an interpreter's globals.
 *
 * Also registers the names it defined, so shadowing `ደምር` gets the same
 * answer as shadowing `ርዝመት` (§8.2). Whether a pre-bound name is implemented
 * in Ahadu or in TypeScript is not something a learner can see, and not
 * something they should have to care about.
 *
 * Throws if the prelude raises at runtime, for the same reason as above.
 */
export function loadLibrary(interpreter: Interpreter): void {
  const before = new Set(interpreter.globals.ownNames());

  const result = interpreter.runLibrary(libraryProgram());
  if (result.diagnostic !== null) {
    const d = result.diagnostic;
    throw new Error(
      `the standard library failed to run: ${d.code} at line ${d.line}: ${d.message}`,
    );
  }

  interpreter.notePreBound(interpreter.globals.ownNames().filter((name) => !before.has(name)));
}
