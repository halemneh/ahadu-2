/**
 * The standard library's loading mechanism (LANGUAGE.md §8.5).
 *
 * The library is Ahadu source run as its own program through the same
 * interpreter. These tests are about that arrangement holding its promises —
 * the learner's line numbers, their step budget, their own names — rather than
 * about what any particular library function computes.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { parse } from '../../../src/parser/index.js';
import type { Program } from '../../../src/parser/index.js';
import { Interpreter, run as bareRun } from '../../../src/interpreter/index.js';
import { run, withLibrary } from '../../../src/engine.js';
import {
  LIBRARY_NAMES,
  LIBRARY_SOURCE,
  libraryProgram,
  loadLibrary,
} from '../../../src/library/index.js';
import { evaluate } from '../../../tools/playground/evaluate.js';
import { code, message, out, runSource } from '../../helpers/evaluate.js';

const lines = (...source: string[]): string => source.join('\n');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** A host that collects what a program wrote. */
function capture(): {
  host: { write: (t: string) => void; readLine: () => string };
  written: string[];
} {
  const written: string[] = [];
  return {
    written,
    host: {
      write: (text: string): void => {
        for (const line of text.replace(/\n$/, '').split('\n')) written.push(line);
      },
      readLine: () => '',
    },
  };
}

function program(source: string): Program {
  const lexed = tokenize(source);
  expect(lexed.diagnostics).toEqual([]);
  const parsed = parse(lexed.tokens);
  expect(parsed.diagnostics).toEqual([]);
  return parsed.program;
}

describe('the library itself is valid Ahadu', () => {
  it('lexes and parses', () => {
    // libraryProgram throws rather than returning diagnostics, because a
    // broken prelude is a bug here and must never surface against a learner's
    // file. This is the test that actually catches it.
    expect(() => libraryProgram()).not.toThrow();
  });

  it('runs without error in a bare interpreter', () => {
    const { host } = capture();
    const interpreter = new Interpreter(host);
    expect(() => loadLibrary(interpreter)).not.toThrow();
  });

  it('writes nothing while loading', () => {
    // A prelude that printed would prepend noise to every program's output.
    const { host, written } = capture();
    loadLibrary(new Interpreter(host));
    expect(written).toEqual([]);
  });

  it('is parsed once and reused', () => {
    expect(libraryProgram()).toBe(libraryProgram());
  });

  it('holds no backtick or interpolation, which the template literal forbids', () => {
    expect(LIBRARY_SOURCE).not.toContain('`');
    expect(LIBRARY_SOURCE).not.toContain('${');
  });
});

describe('LIBRARY_NAMES matches what the prelude defines', () => {
  it('exactly, in order', () => {
    // The declared surface cannot go stale: this diffs the globals before and
    // after loading.
    const { host } = capture();
    const interpreter = new Interpreter(host);
    const before = new Set(interpreter.globals.ownNames());
    loadLibrary(interpreter);
    const added = interpreter.globals.ownNames().filter((name) => !before.has(name));
    expect(added).toEqual([...LIBRARY_NAMES]);
  });

  it('defines every name as something callable', () => {
    const { host } = capture();
    const interpreter = withLibrary(host);
    for (const name of LIBRARY_NAMES) {
      // `ካርታ` is a `ክላስ`; both kinds are callable (§8.6).
      expect(['function', 'class'], name).toContain(interpreter.globals.get(name)?.kind);
    }
  });
});

describe('the spec table matches the library (§8.6)', () => {
  it('lists exactly the functions the library defines', () => {
    // Keeps §8.6 from going stale in either direction.
    const spec = readFileSync(resolve(root, 'spec/LANGUAGE.md'), 'utf8');
    const start = spec.indexOf('### 8.6 Library functions');
    expect(start).toBeGreaterThan(0);
    // Bounded at the section's end, or the slice runs on into §9's catalogue.
    const rest = spec.slice(start);
    // Bounded at the first subsection too: `ካርታ`'s own method table sits
    // below it and its rows look identical to a function row.
    const end = Math.min(...[rest.indexOf('\n---'), rest.indexOf('\n#### ')].filter((i) => i > 0));
    const table = rest.slice(0, end);
    const listed = [...table.matchAll(/^\| `([^`]+)` \| `/gm)].map((m) => m[1] as string);
    expect(listed.sort()).toEqual([...LIBRARY_NAMES].sort());
  });
});

describe('the learner keeps their own line numbers', () => {
  it('reports an error on the line they wrote it on', () => {
    // The whole reason the prelude is a separate program: no offset mechanism
    // anywhere, because tryRun reports against the program it was given.
    const result = runSource(lines('ጻፍ("ሀ")', 'ጻፍ(ያልተገለጸ)'));
    expect(result.errors[0]?.code).toBe('AH3001');
    expect(result.errors[0]?.line).toBe(2);
  });

  it('reports line 1 for a one-line program, however long the prelude is', () => {
    const preludeLines = LIBRARY_SOURCE.split('\n').length;
    expect(preludeLines).toBeGreaterThan(10);
    expect(runSource('ጻፍ(ያልተገለጸ)').errors[0]?.line).toBe(1);
  });
});

describe('the learner keeps their own step budget', () => {
  it('does not spend any of it on the prelude', () => {
    // tryRun resets the counter, so the prelude's cost is not deducted. A
    // budget this tight would fail outright if it were.
    expect(code('ጻፍ(1)', { maxSteps: 12 })).toBe(null);
  });

  it('still enforces the budget on the learner is own work', () => {
    expect(code('እውነት እስከሆነ ድረስ፦\n    ሀ = 1', { maxSteps: 500 })).toBe('AH3018');
  });
});

describe('library functions are pre-bound like built-ins (§8.2)', () => {
  it('can be shadowed', () => {
    expect(out('ደምር = 5\nጻፍ(ደምር)')).toEqual(['5']);
  });

  it('and calling a shadowed one names it, as for a host built-in', () => {
    // Whether a pre-bound name is written in Ahadu or in TypeScript is not
    // something a learner can see, so the error must not differ.
    const text = message('ደምር = 5\nደምር([1])');
    expect(text).toContain('"ደምር"');
    expect(text).toContain('ተግባር ነበር');
  });

  it('is AH3013, the same code', () => {
    expect(code('ደምር = 5\nደምር([1])')).toBe('AH3013');
  });
});

describe('an error inside a library function points at the call (§8.5)', () => {
  it('uses the line the learner called from', () => {
    // Not the line inside the library: that number belongs to a file they
    // cannot open, and framing it shows them a line of their own program that
    // has nothing to do with the error — or a blank one, if their program is
    // shorter than the prelude.
    const result = runSource(lines('ዝ = [1፣ "ሀ"]', 'ጻፍ("በፊት")', 'ጻፍ(ደምር(ዝ))'));
    expect(result.errors[0]?.code).toBe('AH3002');
    expect(result.errors[0]?.line).toBe(3);
  });

  it('names the library function in the message', () => {
    expect(message('ጻፍ(ደምር([1፣ "ሀ"]))')).toContain('"ደምር"');
  });

  it('keeps the original message, which is still the fact', () => {
    expect(message('ጻፍ(ደምር([1፣ "ሀ"]))')).toContain('መደመር አይቻልም');
  });

  it('keeps the library frame in the traceback, so the detail is not lost', () => {
    const result = runSource('ጻፍ(ደምር([1፣ "ሀ"]))');
    expect(result.frames.map((f) => f.name)).toEqual(['ዋና ፕሮግራም', 'ደምር']);
  });

  it('does NOT reattribute a function the learner wrote with the same name', () => {
    // Provenance, not a name match. This is the case a name-based check would
    // get wrong, and it would misreport the learner's own code.
    const source = lines('ተግባር ደምር(ሀ)፦', '    ተመላሽ ሀ + "ጽሁፍ"', '', 'ጻፍ(ደምር(1))');
    const result = runSource(source);
    expect(result.errors[0]?.line).toBe(2);
    expect(result.errors[0]?.message).not.toContain('ውስጥ ተከሰተ');
  });

  it('attributes to the learner is line through their own intermediate call', () => {
    const source = lines('ተግባር የኔ(ዝ)፦', '    ተመላሽ ደምር(ዝ)', '', 'ጻፍ(የኔ([1፣ "ሀ"]))');
    const result = runSource(source);
    // Their line 2 — the deepest frame they actually wrote.
    expect(result.errors[0]?.line).toBe(2);
    expect(result.frames.map((f) => f.name)).toEqual(['ዋና ፕሮግራም', 'የኔ', 'ደምር']);
  });
});

describe('every host loads it — the failure this guards is silent', () => {
  it('the engine run does', () => {
    const { host, written } = capture();
    run(program('ጻፍ(ደምር([1፣ 2]))'), host);
    expect(written).toEqual(['3']);
  });

  it('the bare interpreter run deliberately does not', () => {
    // Kept as the primitive, for tests that want nothing beyond the built-ins.
    const { host } = capture();
    const result = bareRun(program('ጻፍ(ደምር([1፣ 2]))'), host);
    expect(result.diagnostic?.code).toBe('AH3001');
  });

  it('the test helper does, so the conformance corpus runs the shipped language', () => {
    expect(out('ጻፍ(ደምር([1፣ 2]))')).toEqual(['3']);
  });

  it('the playground worker does — which is also the site build path', () => {
    // `tools/site/build/snippet.ts` calls this same `evaluate`, so a lesson
    // cannot teach a library function the build does not have (SITE.md §2).
    const reply = evaluate({ source: 'ጻፍ(ደምር([1፣ 2]))', input: [], maxSteps: 200_000 });
    expect(reply.diagnostics).toEqual([]);
    expect(reply.output).toBe('3\n');
  });

  it('withLibrary does, for a host driving one interpreter across programs', () => {
    const { host, written } = capture();
    const interpreter = withLibrary(host);
    interpreter.tryRun(program('ሀ = ደምር([1፣ 2])'));
    interpreter.tryRun(program('ጻፍ(ሀ + 1)'));
    expect(written).toEqual(['4']);
  });
});
