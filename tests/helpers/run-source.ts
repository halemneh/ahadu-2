/**
 * The one place that wires source → lexer → parser → interpreter with a
 * capturing host, so every conformance case goes through the same path a real
 * program would.
 *
 * The body lands with the interpreter. Until then it throws, and
 * `tests/conformance/run.test.ts` skips the suites that call it (guarded on
 * `src/interpreter/index.ts` existing), so a spec-only checkout stays green.
 * The types below are the contract the stages have to satisfy.
 */

/** A diagnostic from any stage. Re-exported from `src/` once the stages land. */
export interface Diagnostic {
  /** Stable code from LANGUAGE.md §9.2, e.g. `AH3003`. */
  code: string;
  /** Amharic message text. */
  message: string;
  line: number;
  startCol: number;
  endCol: number;
  stage: 'lexer' | 'parser' | 'runtime';
}

export interface RunResult {
  /** Lines written by ጻፍ, in order, without trailing newlines. */
  output: string[];
  /** Lexer diagnostics, then parser, then the single runtime error if any. */
  errors: Diagnostic[];
  /** Rendered value of the last statement, or null when it produced ምንም. */
  value: string | null;
}

export function runSource(_source: string): Promise<RunResult> {
  throw new Error(
    'runSource is not implemented yet — the interpreter stage has not landed. ' +
      'See spec/TOOLING.md §3.',
  );
}
