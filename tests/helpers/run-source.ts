/**
 * The one place that wires source → lexer → parser → interpreter with a
 * capturing host, so every conformance case goes through the same path a real
 * program would.
 *
 * A runner stops at the first stage that reports: lexing problems make the
 * token stream untrustworthy, so parsing it would pile guesses on a known
 * error (LANGUAGE.md §9.3).
 */

import { tokenize } from '../../src/lexer/index.js';
import { parse } from '../../src/parser/index.js';
import { render, run } from '../../src/interpreter/index.js';
import type { Frame, RunOptions } from '../../src/interpreter/index.js';
import type { Diagnostic } from '../../src/diagnostics.js';

export interface RunResult {
  /** Lines written by ጻፍ, in order, without trailing newlines. */
  output: string[];
  /** Lexer diagnostics, or parser, or the single runtime error — never a mix. */
  errors: Diagnostic[];
  /** Rendered value of the last statement, or null when it produced ምንም. */
  value: string | null;
  /** The call stack when a runtime error happened, outermost first. */
  frames: readonly Frame[];
  /** The stage that stopped the run, or null when it completed. */
  stoppedAt: 'lexer' | 'parser' | 'runtime' | null;
}

export interface RunSourceOptions extends RunOptions {
  /** Lines served to `አንብብ`, in order. */
  readonly input?: readonly string[];
}

export function runSource(source: string, options: RunSourceOptions = {}): RunResult {
  const output: string[] = [];
  const empty = { output, value: null, frames: [] as readonly Frame[] };

  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    return { ...empty, errors: [...lexed.diagnostics], stoppedAt: 'lexer' };
  }

  const parsed = parse(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    return { ...empty, errors: [...parsed.diagnostics], stoppedAt: 'parser' };
  }

  const pending = [...(options.input ?? [])];
  const result = run(
    parsed.program,
    {
      write: (text) => {
        // ጻፍ writes a trailing newline; the corpus compares whole lines.
        for (const line of text.replace(/\n$/, '').split('\n')) output.push(line);
      },
      readLine: (prompt) => {
        if (prompt !== null) output.push(prompt);
        return pending.shift() ?? '';
      },
    },
    options,
  );

  return {
    output,
    errors: result.diagnostic === null ? [] : [result.diagnostic],
    value: result.value.kind === 'nothing' ? null : render(result.value),
    frames: result.frames,
    stoppedAt: result.diagnostic === null ? null : 'runtime',
  };
}
