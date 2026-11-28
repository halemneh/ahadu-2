/**
 * The playground's console (TOOLING.md §2.2): a program that waits for
 * input, answers given one at a time, and Ahadu typed after the program.
 *
 * A session is replayed from the start on every interaction, so these play
 * the guessing game the way a reader does — read the hint, then answer —
 * and check that each replay lands exactly where the last one stopped.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSession } from '../../../tools/playground/session.js';
import type { Line, SessionReply, SessionRequest } from '../../../tools/playground/session.js';

const GAME = readFileSync(
  resolve(import.meta.dirname, '../../../examples/10-ቁጥር-ገምት.ahadu'),
  'utf8',
);

function session(entries: string[], inputs: string[] = [], seed = 7): SessionRequest {
  return { entries, inputs, seed, now: 0, maxSteps: 1_000_000 };
}

/** Everything the console shows, as one string. */
function text(reply: SessionReply): string {
  return reply.transcript
    .map((line: Line) => {
      switch (line.kind) {
        case 'out':
          return line.text;
        case 'input':
          return `${line.text}\n`;
        case 'entry':
          return `› ${line.text}\n`;
        case 'value':
          return `${line.text}\n`;
        case 'error':
          return `[${line.diagnostic.code}]\n`;
      }
    })
    .join('');
}

describe('a program that reads input', () => {
  it('stops at አንብብ with its prompt, rather than reading ""', () => {
    const reply = runSession(session(['ስም = አንብብ("ስም፦ ")\nጻፍ("ሰላም " + ስም)']));
    expect(reply.waiting).toEqual({ prompt: 'ስም፦ ' });
    expect(text(reply)).toBe('ስም፦ ');
    expect(reply.programDiagnostics).toEqual([]);
  });

  it('carries on from there once answered, with the answer shown after its prompt', () => {
    const reply = runSession(session(['ስም = አንብብ("ስም፦ ")\nጻፍ("ሰላም " + ስም)'], ['አበበ']));
    expect(reply.waiting).toBeNull();
    expect(text(reply)).toBe('ስም፦ አበበ\nሰላም አበበ\n');
  });

  it('plays the guessing game to the end, one guess at a time', () => {
    // A binary search, the way a reader plays: read the hint, then guess.
    let low = 1;
    let high = 100;
    const guesses: string[] = [];
    let reply = runSession(session([GAME], guesses));

    for (let turn = 0; turn < 5 && reply.waiting !== null; turn += 1) {
      expect(reply.waiting.prompt).toBe('ግምትህ፦ ');
      const before = text(reply);
      const guess = Math.floor((low + high) / 2);
      guesses.push(String(guess));
      reply = runSession(session([GAME], guesses));

      // The replay reproduces everything already shown, then goes on.
      const after = text(reply);
      expect(after.startsWith(before)).toBe(true);
      const hint = after.slice(before.length);
      if (hint.includes('ይበልጣል')) low = guess + 1;
      if (hint.includes('ያንሳል')) high = guess - 1;
    }

    expect(reply.waiting).toBeNull();
    expect(text(reply)).toMatch(/አገኘኸው|ሙከራህ ተጨረሰ/);
  });

  it('draws the same secret on every replay of one session', () => {
    const first = text(runSession(session([GAME], ['50'])));
    const again = text(runSession(session([GAME], ['50'])));
    expect(again).toBe(first);
  });
});

describe('Ahadu typed after the program', () => {
  it('runs with the program’s names still bound, and shows its value', () => {
    const reply = runSession(session(['ሀ = 20', 'ሀ * 2']));
    expect(reply.transcript).toEqual([
      { kind: 'entry', text: 'ሀ * 2' },
      { kind: 'value', text: '40' },
    ]);
  });

  it('can start without a program at all', () => {
    const reply = runSession(session(['', 'ጻፍ("ሰላም")']));
    expect(text(reply)).toBe('› ጻፍ("ሰላም")\nሰላም\n');
  });

  it('can ask for input too', () => {
    const reply = runSession(session(['', 'አንብብ("? ")']));
    expect(reply.waiting).toEqual({ prompt: '? ' });
  });

  it('carries on after an entry fails, and keeps that error out of the program’s', () => {
    const reply = runSession(session(['ሀ = 1', 'ያልታወቀ', 'ሀ + 1']));
    expect(text(reply)).toBe('› ያልታወቀ\n[AH3001]\n› ሀ + 1\n2\n');
    expect(reply.programDiagnostics).toEqual([]);
  });
});

describe('the program’s own errors', () => {
  it('are reported for the errors panel, with the call stack', () => {
    const reply = runSession(session(['ተግባር ረ()፦\n    ተመላሽ 1 / 0\nረ()']));
    expect(reply.programDiagnostics.map((d) => d.code)).toEqual(['AH3003']);
    expect(reply.programFrames.length).toBeGreaterThan(1);
  });

  it('include every parse error, not just the first', () => {
    const reply = runSession(session(['ሀ = (\nለ = )']));
    expect(reply.programDiagnostics.length).toBeGreaterThan(0);
    expect(reply.waiting).toBeNull();
  });
});
