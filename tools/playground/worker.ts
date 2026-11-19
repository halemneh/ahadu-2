/**
 * Evaluation, off the main thread (TOOLING.md §2.2).
 *
 * A program runs here rather than on the page for one reason: Ahadu's
 * evaluator is synchronous, so an endless loop would freeze the tab. In a
 * worker it cannot, and the page can terminate it outright.
 *
 * The step budget is the first line of defence and gives a proper Ahadu error
 * (`AH3018`); terminating the worker is the second, for a program that
 * somehow gets past it.
 */

import { tokenize } from '../../src/lexer/index.js';
import { parse } from '../../src/parser/index.js';
import { render, run } from '../../src/interpreter/index.js';
import type { Frame } from '../../src/interpreter/index.js';
import type { Diagnostic } from '../../src/diagnostics.js';

export interface RunRequest {
  readonly source: string;
  /** Lines the input panel holds, served to `አንብብ` in order. */
  readonly input: readonly string[];
  readonly maxSteps: number;
}

export interface RunReply {
  /** Everything `ጻፍ` wrote, as it was written. */
  readonly output: string;
  /** The one diagnostic that stopped the program, if any. */
  readonly diagnostic: Diagnostic | null;
  readonly frames: readonly Frame[];
  /** The rendered value of the last statement, or null for `ምንም`. */
  readonly value: string | null;
  /** The stage that stopped the run, or null when it completed. */
  readonly stoppedAt: 'lexer' | 'parser' | 'runtime' | null;
}

function evaluate(request: RunRequest): RunReply {
  const nothing = { output: '', value: null, frames: [] as readonly Frame[] };

  const lexed = tokenize(request.source);
  if (lexed.diagnostics.length > 0) {
    return { ...nothing, diagnostic: lexed.diagnostics[0] ?? null, stoppedAt: 'lexer' };
  }

  const parsed = parse(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    return { ...nothing, diagnostic: parsed.diagnostics[0] ?? null, stoppedAt: 'parser' };
  }

  let output = '';
  const pending = [...request.input];

  const result = run(
    parsed.program,
    {
      write: (text) => {
        output += text;
      },
      readLine: (prompt) => {
        if (prompt !== null) output += prompt;
        return pending.shift() ?? '';
      },
    },
    { maxSteps: request.maxSteps },
  );

  return {
    output,
    diagnostic: result.diagnostic,
    frames: result.frames,
    value: result.value.kind === 'nothing' ? null : render(result.value),
    stoppedAt: result.diagnostic === null ? null : 'runtime',
  };
}

/**
 * The part of the worker global this file uses.
 *
 * TypeScript cannot load the DOM and WebWorker libraries together — they
 * define overlapping globals — and the rest of the playground needs the DOM
 * one. Naming the two members used here is cheaper than fighting that, and
 * everything downstream of the cast is fully typed.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage: (message: RunReply) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event: MessageEvent<RunRequest>): void => {
  scope.postMessage(evaluate(event.data));
};
