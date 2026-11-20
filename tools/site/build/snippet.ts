/**
 * Code samples, and the promise the site makes about them (SITE.md §2).
 *
 * Every Ahadu snippet on the site is run by the real interpreter at build
 * time, and a snippet whose output is not what the page claims fails the
 * build. v1 shipped a documented language whose conditionals were inverted and
 * nothing caught it, because the tests asserted on tree shapes and the
 * documentation was prose nobody ran (CHANGES-FROM-V1.md, C01). A teaching
 * site is that same failure aimed at beginners, who cannot tell a typo in a
 * lesson from a mistake of their own.
 *
 * So this file is a conformance suite that happens to render HTML. Nothing
 * here knows anything about the language: it imports the interpreter.
 */

import { evaluate } from '../../playground/evaluate.js';
import { formatDiagnostic } from '../../../src/diagnostics.js';

/** How much a runaway snippet is allowed before it is stopped. */
export const MAX_STEPS = 2_000_000;

export type SnippetKind =
  /** A whole program. Runs, and must not fail. */
  | 'program'
  /** A whole program that must fail, with a named code. Errors are taught. */
  | 'error'
  /** Not a whole program: highlighted, never run. The one escape hatch. */
  | 'fragment';

export interface Snippet {
  readonly code: string;
  readonly kind: SnippetKind;
  /** Exact expected output, when the page states one. */
  readonly expectedOutput: string | null;
  /** The diagnostic code an `error` snippet must raise. */
  readonly expectedCode: string | null;
  /** Lines served to አንብብ, from a `ግቤት` fence. */
  readonly input: readonly string[];
}

/**
 * Reads a fence's info string.
 *
 * `ahadu` · `ahadu fragment` · `ahadu error=AH2008`
 *
 * Anything that is not understood is rejected rather than ignored, so a typo
 * in a flag cannot silently turn checking off — which is the one way this
 * whole mechanism could quietly stop working.
 */
export function parseInfo(info: string): { kind: SnippetKind; expectedCode: string | null } {
  const words = info.trim().split(/\s+/).filter(Boolean);
  if (words[0] !== 'ahadu') throw new Error(`not an Ahadu fence: ${info}`);

  let kind: SnippetKind = 'program';
  let expectedCode: string | null = null;

  for (const word of words.slice(1)) {
    if (word === 'fragment') {
      kind = 'fragment';
      continue;
    }

    const error = /^error=(AH\d{4})$/.exec(word);
    if (error?.[1] !== undefined) {
      kind = 'error';
      expectedCode = error[1];
      continue;
    }

    throw new Error(`unknown flag on an Ahadu fence: ${word}`);
  }

  return { kind, expectedCode };
}

/** What running a snippet produced, for rendering beneath it. */
export interface SnippetResult {
  readonly output: string;
  readonly failed: boolean;
}

/**
 * Runs a snippet and holds it to what the page claims.
 *
 * `where` names the file and makes a failure something an author can act on
 * without hunting: the message carries the snippet's own text.
 */
export function verify(snippet: Snippet, where: string): SnippetResult {
  if (snippet.kind === 'fragment') return { output: '', failed: false };

  const reply = evaluate({
    source: snippet.code,
    input: snippet.input,
    maxSteps: MAX_STEPS,
  });

  const failed = reply.stoppedAt !== null;

  /*
   * Printed before it is thrown, because the build tool's logger shows only
   * the first line of an error — and the useful part of this one is the
   * expected-against-actual underneath. An author who cannot see what differed
   * has been told their page is wrong and nothing more.
   */
  const problem = (why: string): never => {
    const full = `\n${where}\n\n  ${why}\n\n${indent(snippet.code)}\n`;
    console.error(full);
    throw new Error(`${where}: ${why.split('\n')[0] ?? why}`);
  };

  if (snippet.kind === 'error') {
    if (!failed) {
      problem(`this snippet is marked error=${snippet.expectedCode ?? '?'} but it ran cleanly`);
    }
    const codes = reply.diagnostics.map((d) => d.code);
    if (!codes.includes(snippet.expectedCode ?? '')) {
      problem(
        `this snippet should raise ${snippet.expectedCode ?? '?'} but raised ${
          codes.join(', ') || 'nothing'
        }`,
      );
    }
    return { output: reply.diagnostics.map((d) => formatDiagnostic(d)).join('\n'), failed: true };
  }

  if (failed) {
    const first = reply.diagnostics[0];
    problem(
      `this snippet is meant to run, but failed: ${
        first === undefined ? 'unknown error' : formatDiagnostic(first)
      }`,
    );
  }

  if (snippet.expectedOutput !== null && reply.output !== snippet.expectedOutput) {
    problem(
      `this snippet's output is not what the page says.\n\n  expected:\n${indent(
        snippet.expectedOutput,
        4,
      )}\n\n  actual:\n${indent(reply.output, 4)}`,
    );
  }

  return { output: reply.output, failed: false };
}

function indent(text: string, by = 2): string {
  const pad = ' '.repeat(by);
  return text
    .split('\n')
    .map((line) => pad + line)
    .join('\n');
}
