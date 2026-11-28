/**
 * A console session: the program, what was typed after it, and what it
 * printed (TOOLING.md §2.2).
 *
 * The playground's output panel is a console. **Run** starts a session with
 * the editor's program; a line typed at the prompt underneath either answers
 * the `አንብብ` the program is waiting on, or — when nothing is waiting — is
 * run as Ahadu in the same session, with the program's names still bound,
 * as the CLI's REPL does.
 *
 * The evaluator is synchronous and runs in a worker, so a program cannot
 * stop half way and wait for a person to type. It does not need to. A
 * session is replayed from the start on every interaction, with every answer
 * given so far: the seed and the clock are fixed for the session, so the
 * replay reaches exactly the point it stopped at before, takes the new
 * answer, and carries on to the next `አንብብ`. This needs no shared memory
 * and no cross-origin isolation headers, which GitHub Pages cannot send —
 * and an Ahadu program has no effect other than its output, so running its
 * first part again changes nothing the reader can see.
 *
 * Nothing here touches the DOM, so it is tested directly
 * (`tests/unit/playground/session.test.ts`).
 */

import type { Diagnostic } from '../../src/diagnostics.js';
import { internalError } from '../../src/diagnostics.js';
import { tokenize } from '../../src/lexer/index.js';
import { parse } from '../../src/parser/index.js';
import { InputPending, render } from '../../src/interpreter/index.js';
import type { Frame } from '../../src/interpreter/index.js';
import { withLibrary } from '../../src/engine.js';
import { MAX_OUTPUT } from './evaluate.js';

export interface SessionRequest {
  /** The program first, then each console entry, in the order typed. */
  readonly entries: readonly string[];
  /** Every line typed in answer to `አንብብ`, in order. */
  readonly inputs: readonly string[];
  /** Fixed for the session, so a replay draws the same numbers. */
  readonly seed: number;
  /** Fixed for the session, so `ዛሬ` does not change under a replay. */
  readonly now: number;
  /** Per entry, as `tryRun` counts it. */
  readonly maxSteps: number;
}

/** One piece of the console's transcript, in the order it happened. */
export type Line =
  /** What `ጻፍ` wrote, and an `አንብብ` prompt. */
  | { readonly kind: 'out'; readonly text: string }
  /** An answer typed in reply to `አንብብ`. */
  | { readonly kind: 'input'; readonly text: string }
  /** A console entry, echoed as it was typed. */
  | { readonly kind: 'entry'; readonly text: string }
  /** The value of an entry's last statement, when it is not `ምንም`. */
  | { readonly kind: 'value'; readonly text: string }
  /** An error that stopped an entry. */
  | {
      readonly kind: 'error';
      readonly diagnostic: Diagnostic;
      readonly frames: readonly Frame[];
    };

export interface SessionReply {
  readonly transcript: readonly Line[];
  /** Set when the session is stopped at `አንብብ`, waiting for an answer. */
  readonly waiting: { readonly prompt: string | null } | null;
  /** Output past MAX_OUTPUT was dropped. */
  readonly truncated: boolean;
  /**
   * Every diagnostic the program itself (the first entry) raised, for the
   * errors panel. A console entry's error is shown in the console only: it
   * says nothing about the program in the editor.
   */
  readonly programDiagnostics: readonly Diagnostic[];
  /** The call stack of the program's runtime error, if it had one. */
  readonly programFrames: readonly Frame[];
}

/** Replays a session from the start and reports where it ended up. */
export function runSession(request: SessionRequest): SessionReply {
  try {
    return replay(request);
  } catch (thrown) {
    // Every stage returns AH9001 for its own failures; this catches anything
    // between them, so the console never shows a raw error.
    const diagnostic = internalError('runtime', thrown);
    return {
      transcript: [{ kind: 'error', diagnostic, frames: [] }],
      waiting: null,
      truncated: false,
      programDiagnostics: [diagnostic],
      programFrames: [],
    };
  }
}

function replay(request: SessionRequest): SessionReply {
  const transcript: Line[] = [];
  let size = 0;
  let truncated = false;

  /** Appends to the transcript, merging runs of output, within MAX_OUTPUT. */
  const add = (line: Line): void => {
    if (truncated) return;
    const text = line.kind === 'error' ? line.diagnostic.message : line.text;
    if (size + text.length > MAX_OUTPUT) {
      truncated = true;
      if (line.kind === 'out') {
        transcript.push({ kind: 'out', text: text.slice(0, MAX_OUTPUT - size) });
      }
      return;
    }
    size += text.length;
    const last = transcript[transcript.length - 1];
    if (line.kind === 'out' && last?.kind === 'out') {
      transcript[transcript.length - 1] = { kind: 'out', text: last.text + line.text };
    } else {
      transcript.push(line);
    }
  };

  const answers = [...request.inputs];
  const interpreter = withLibrary(
    {
      write: (text) => {
        add({ kind: 'out', text });
      },
      readLine: (prompt) => {
        if (prompt !== null) add({ kind: 'out', text: prompt });
        const answer = answers.shift();
        if (answer === undefined) throw new InputPending(prompt);
        add({ kind: 'input', text: answer });
        return answer;
      },
    },
    { maxSteps: request.maxSteps, seed: request.seed, now: request.now },
  );

  let programDiagnostics: readonly Diagnostic[] = [];
  let programFrames: readonly Frame[] = [];

  for (const [index, source] of request.entries.entries()) {
    const isProgram = index === 0;
    if (!isProgram) add({ kind: 'entry', text: source });

    const lexed = tokenize(source);
    const parsed = lexed.diagnostics.length > 0 ? null : parse(lexed.tokens);
    const early = parsed === null ? lexed.diagnostics : parsed.diagnostics;
    if (parsed === null || early.length > 0) {
      for (const diagnostic of early) add({ kind: 'error', diagnostic, frames: [] });
      if (isProgram) programDiagnostics = early;
      continue;
    }

    const result = interpreter.tryRun(parsed.program);
    if (result.waiting !== undefined) {
      return {
        transcript,
        waiting: result.waiting,
        truncated,
        programDiagnostics,
        programFrames,
      };
    }
    if (result.diagnostic !== null) {
      add({ kind: 'error', diagnostic: result.diagnostic, frames: result.frames });
      if (isProgram) {
        programDiagnostics = [result.diagnostic];
        programFrames = result.frames;
      }
      // A REPL carries on after an error, and so does a session: the next
      // entry runs with whatever the failed one had bound before it failed.
      continue;
    }
    if (result.value.kind !== 'nothing') add({ kind: 'value', text: render(result.value) });
  }

  return { transcript, waiting: null, truncated, programDiagnostics, programFrames };
}
