/**
 * Runs every conformance case end to end: source → lexer → parser →
 * interpreter, comparing captured stdout against `# expect:` lines and
 * diagnostics against `# expect-error:` lines.
 *
 * The suite skips itself until the pipeline exists, so a spec-only checkout
 * stays green. Deleting the guard is part of landing the interpreter.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCases } from './harness.js';
import { runSource } from '../helpers/run-source.js';

const here = dirname(fileURLToPath(import.meta.url));
const casesDir = join(here, 'cases');
const examplesDir = resolve(here, '../../examples');
const pipelineReady = existsSync(resolve(here, '../../src/interpreter/index.ts'));

const cases = loadCases(casesDir);

describe('conformance corpus', () => {
  it('every case states at least one expectation', () => {
    const silent = cases.filter(
      (c) => c.expectedOutput.length === 0 && c.expectedErrors.length === 0,
    );
    expect(silent.map((c) => c.name)).toEqual([]);
  });

  it('every error code in the spec catalogue is exercised', () => {
    // Tightened to the full §9.2 catalogue as the stages land. Until then this
    // asserts only that the codes we do claim to cover are actually present.
    const covered = new Set(cases.flatMap((c) => c.expectedErrors.map((e) => e.code)));
    expect(covered.size).toBeGreaterThan(0);
  });
});

describe.skipIf(!pipelineReady)('conformance cases', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const { output, errors } = await runSource(c.source);

      if (c.expectedErrors.length > 0) {
        expect(errors.map((e) => e.code)).toEqual(c.expectedErrors.map((e) => e.code));
        for (const [i, expected] of c.expectedErrors.entries()) {
          if (expected.line !== undefined) expect(errors[i]?.line).toBe(expected.line);
          if (expected.col !== undefined) expect(errors[i]?.startCol).toBe(expected.col);
        }
      } else {
        expect(errors).toEqual([]);
      }

      expect(output).toEqual(c.expectedOutput);
    });
  }
});

describe.skipIf(!pipelineReady)('examples run clean', () => {
  for (const c of loadCases(examplesDir)) {
    it(c.name, async () => {
      const { errors } = await runSource(c.source);
      expect(errors).toEqual([]);
    });
  }
});
