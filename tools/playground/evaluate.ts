/**
 * Running a program, and what comes back (TOOLING.md §2.2).
 *
 * No globals here, so this is importable anywhere — `worker.ts` is the three
 * lines that bind it to a worker's `self`, and the tests call it directly.
 * The same split as `src/cli/main.ts` against the rest of the CLI, for the
 * same reason: nothing that makes a decision should need a host to run.
 *
 * A program runs off the main thread for one reason: Ahadu's evaluator is
 * synchronous, so an endless loop would freeze the tab. In a worker it cannot,
 * and the page can terminate it outright. The step budget is the first line of
 * defence and gives a proper Ahadu error (`AH3018`); terminating the worker is
 * the second, for anything that gets past it.
 */

import { tokenize } from '../../src/lexer/index.js';
import { parse } from '../../src/parser/index.js';
import { render } from '../../src/interpreter/index.js';
// The library-loading `run`: the site's build-time snippet checker calls
// this same function, so a lesson cannot teach a library the build does not
// have (§8.5, SITE.md §2).
import { run } from '../../src/engine.js';
import type { Frame } from '../../src/interpreter/index.js';
import type { Diagnostic } from '../../src/diagnostics.js';
import { internalError } from '../../src/diagnostics.js';

export interface RunRequest {
  readonly source: string;
  /** Lines the input panel holds, served to `አንብብ` in order. */
  readonly input: readonly string[];
  readonly maxSteps: number;
  /**
   * Starting seed for `ዘፈቀደ_ቁጥር`, or omitted for the interpreter's fixed default.
   *
   * Omitting it is the safe direction: the site's snippet checker calls this
   * function at build time and compares the output to what the page claims
   * (SITE.md §2), so a caller that says nothing gets a program whose random
   * numbers are the same every build. The playground passes a changing seed,
   * because a guessing game with one answer is not a game.
   */
  readonly seed?: number;
  /** The instant `ዛሬ` reports, or omitted for the interpreter's fixed default. */
  readonly now?: number;
}

/**
 * How much of a program's output is kept, in UTF-16 units.
 *
 * A loop that prints until the step budget stops it wrote 714,287 lines —
 * fifteen million pixels of panel, built in the worker, posted across and
 * laid out — with the error that explains it at the very bottom. The rest is
 * dropped and the reply says so.
 */
export const MAX_OUTPUT = 100_000;

export interface RunReply {
  /** What `ጻፍ` wrote, as it was written, up to MAX_OUTPUT. */
  readonly output: string;
  /** Output past MAX_OUTPUT was dropped. */
  readonly truncated?: boolean;
  /**
   * Every diagnostic from the stage that stopped the run.
   *
   * Not just the first: a lexer or a parser reports as many problems as it
   * finds, and a page that showed only one would be hiding the rest from
   * someone trying to fix them. Only the runtime stage is ever singular,
   * because evaluation stops at the first error (§9.3).
   */
  readonly diagnostics: readonly Diagnostic[];
  readonly frames: readonly Frame[];
  /** The rendered value of the last statement, or null for `ምንም`. */
  readonly value: string | null;
  /** The stage that stopped the run, or null when it completed. */
  readonly stoppedAt: 'lexer' | 'parser' | 'runtime' | null;
}

/**
 * Runs one request. Exported so it can be tested without a worker — this is
 * the function that decides which diagnostics the page gets to see.
 */
export function evaluate(request: RunRequest): RunReply {
  try {
    return evaluateUnguarded(request);
  } catch (thrown) {
    // Each stage already turns its own failures into AH9001; this catches
    // anything between them, so the page never shows a raw error (§9.3).
    return {
      output: '',
      diagnostics: [internalError('runtime', thrown)],
      frames: [],
      value: null,
      stoppedAt: 'runtime',
    };
  }
}

function evaluateUnguarded(request: RunRequest): RunReply {
  const nothing = { output: '', value: null, frames: [] as readonly Frame[] };

  const lexed = tokenize(request.source);
  if (lexed.diagnostics.length > 0) {
    return { ...nothing, diagnostics: lexed.diagnostics, stoppedAt: 'lexer' };
  }

  const parsed = parse(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    return { ...nothing, diagnostics: parsed.diagnostics, stoppedAt: 'parser' };
  }

  let output = '';
  let truncated = false;
  const keep = (text: string): void => {
    if (truncated) return;
    if (output.length + text.length > MAX_OUTPUT) {
      output += text.slice(0, MAX_OUTPUT - output.length);
      truncated = true;
      return;
    }
    output += text;
  };
  const pending = [...request.input];

  const result = run(
    parsed.program,
    {
      write: keep,
      readLine: (prompt) => {
        if (prompt !== null) keep(prompt);
        return pending.shift() ?? '';
      },
    },
    {
      maxSteps: request.maxSteps,
      ...(request.seed === undefined ? {} : { seed: request.seed }),
      ...(request.now === undefined ? {} : { now: request.now }),
    },
  );

  return {
    output,
    ...(truncated ? { truncated: true } : {}),
    diagnostics: result.diagnostic === null ? [] : [result.diagnostic],
    frames: result.frames,
    value: result.value.kind === 'nothing' ? null : render(result.value),
    stoppedAt: result.diagnostic === null ? null : 'runtime',
  };
}
