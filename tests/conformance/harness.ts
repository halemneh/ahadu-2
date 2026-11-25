/**
 * Conformance harness.
 *
 * A case is an Ahadu program that carries its own expectations in comment
 * headers (TOOLING.md §3):
 *
 *   # input: <one line served to አንብብ>
 *   # expect: <exact stdout line>
 *   # expect-error: <CODE>
 *   # expect-error: <CODE> at <line>:<col>
 *
 * `# input:` lines are served to `አንብብ` in the order they appear. Without
 * them an interactive program could only ever be tested against the empty
 * string, which is the one input a learner never types.
 *
 * Expectations are program behavior — never token or AST snapshots.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ExpectedError {
  code: string;
  line?: number;
  col?: number;
}

export interface ConformanceCase {
  name: string;
  path: string;
  source: string;
  expectedOutput: string[];
  expectedErrors: ExpectedError[];
  /** Lines served to `አንብብ`, in order. */
  input: string[];
}

const EXPECT = /^#\s*expect:\s?(.*)$/;
const INPUT = /^#\s*input:\s?(.*)$/;
const EXPECT_ERROR = /^#\s*expect-error:\s*([A-Z]{2}\d{4})(?:\s+at\s+(\d+):(\d+))?\s*$/;

export function parseCase(name: string, path: string, source: string): ConformanceCase {
  const expectedOutput: string[] = [];
  const expectedErrors: ExpectedError[] = [];
  const input: string[] = [];

  for (const line of source.split(/\r\n|\r|\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;

    const err = EXPECT_ERROR.exec(trimmed);
    if (err) {
      const [, code, l, c] = err;
      expectedErrors.push({
        code: code!,
        ...(l ? { line: Number(l) } : {}),
        ...(c ? { col: Number(c) } : {}),
      });
      continue;
    }

    // Matched against the line with only its *leading* indentation removed:
    // trailing spaces are part of the input a case is supplying, and a case
    // that wanted to test trimming could not express one otherwise.
    const given = INPUT.exec(line.replace(/^\s+/, ''));
    if (given) {
      input.push(given[1] ?? '');
      continue;
    }

    const out = EXPECT.exec(trimmed);
    if (out) expectedOutput.push(out[1] ?? '');
  }

  return { name, path, source, expectedOutput, expectedErrors, input };
}

export function loadCases(dir: string): ConformanceCase[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ahadu'))
    .sort()
    .map((f) => {
      const path = join(dir, f);
      return parseCase(f.replace(/\.ahadu$/, ''), path, readFileSync(path, 'utf8'));
    });
}
