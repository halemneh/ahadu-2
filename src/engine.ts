/**
 * Running a program with the standard library loaded (LANGUAGE.md §8.5).
 *
 * This exists so that no host has to remember to load the library. There are
 * four of them — the CLI, the REPL, the playground worker and the test helper
 * — and they do not share a code path. If loading were opt-in, the realistic
 * failure is not that someone forgets once: it is that the *site build*
 * forgets while the playground does not, and then the site verifies a
 * different language from the one it teaches, silently, which is the exact
 * failure SITE.md §2 exists to prevent.
 *
 * So `run` here loads it, and `run` in `src/interpreter/` stays the bare
 * primitive it always was, for the tests that need a program with nothing
 * pre-bound beyond the built-ins.
 */

import type { Program } from './parser/index.js';
import { Interpreter } from './interpreter/index.js';
import type { Host, RunOptions, RunResult } from './interpreter/index.js';
import { loadLibrary } from './library/index.js';

/**
 * Runs a program with the standard library in its globals.
 *
 * Never throws, exactly as `run` does not: a runtime error comes back in
 * `RunResult.diagnostic` with the call stack as it stood. A failure in the
 * library itself is the one exception, and it is a bug in this repository
 * rather than anything a program did — see `loadLibrary`.
 */
export function run(program: Program, host: Host, options: RunOptions = {}): RunResult {
  return withLibrary(host, options).tryRun(program);
}

/**
 * An interpreter with the library already loaded, for a host that drives one
 * across several programs — the REPL does, and so would a frame loop.
 */
export function withLibrary(host: Host, options: RunOptions = {}): Interpreter {
  const interpreter = new Interpreter(host, options);
  loadLibrary(interpreter);
  return interpreter;
}
