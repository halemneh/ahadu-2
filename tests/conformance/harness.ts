/**
 * Conformance harness.
 *
 * A case is an Ahadu program that carries its own expectations in comment
 * headers (TOOLING.md §3):
 *
 *   # expect: <exact stdout line>
 *   # expect-error: <CODE>
 *   # expect-error: <CODE> at <line>:<col>
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
}

const EXPECT = /^#\s*expect:\s?(.*)$/;
const EXPECT_ERROR = /^#\s*expect-error:\s*([A-Z]{2}\d{4})(?:\s+at\s+(\d+):(\d+))?\s*$/;

export function parseCase(name: string, path: string, source: string): ConformanceCase {
  const expectedOutput: string[] = [];
  const expectedErrors: ExpectedError[] = [];

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

    const out = EXPECT.exec(trimmed);
    if (out) expectedOutput.push(out[1] ?? '');
  }

  return { name, path, source, expectedOutput, expectedErrors };
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
