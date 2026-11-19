/**
 * `examples/errors/` — programs that are meant to fail.
 *
 * They exist so the playground has something to show in its ስተቶች panel, and
 * they are tested for the same reason the working examples are: a fixture
 * that quietly stops demonstrating what it claims is worse than no fixture.
 *
 * They cannot live in `examples/` itself, where `tests/conformance/run.test.ts`
 * asserts everything runs clean.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyse } from '../../../tools/playground/view.js';
import { runSource } from '../../helpers/run-source.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = resolve(root, 'examples/errors');

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.ahadu'))
  .sort();

/** What the playground's panel would show for a file: every stage's findings. */
function panelCodes(name: string): string[] {
  const source = readFileSync(resolve(dir, name), 'utf8');
  return analyse(source).diagnostics.map((d) => d.code);
}

/** What a runner reports: the first stage that complains, and nothing after. */
function runnerCodes(name: string): string[] {
  const source = readFileSync(resolve(dir, name), 'utf8');
  return runSource(source, { maxSteps: 200_000 }).errors.map((d) => d.code);
}

describe('the error examples exist and are listed', () => {
  it('there are several', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it('every one of them actually fails', () => {
    for (const name of files) {
      expect(runnerCodes(name), name).not.toEqual([]);
    }
  });
});

describe('each shows what its name claims', () => {
  it('the lexical one reports several AH1xxx at once', () => {
    const codes = panelCodes('01-የቃላት-ስተቶች.ahadu');
    const lexical = codes.filter((code) => code.startsWith('AH1'));
    expect(lexical.length).toBeGreaterThanOrEqual(3);
    expect(new Set(lexical).size).toBeGreaterThanOrEqual(3);
  });

  it('the syntactic one reports several AH2xxx at once', () => {
    const codes = panelCodes('02-የአገባብ-ስተቶች.ahadu');
    const syntactic = codes.filter((code) => code.startsWith('AH2'));
    expect(syntactic.length).toBeGreaterThanOrEqual(3);
  });

  it('the syntactic one includes the word-order mistake it is about', () => {
    const source = readFileSync(resolve(dir, '02-የአገባብ-ስተቶች.ahadu'), 'utf8');
    const messages = analyse(source).diagnostics.map((d) => d.message);
    expect(messages.some((m) => m.includes('ሁኔታው ከ"ከሆነ" በፊት'))).toBe(true);
  });

  it('the runtime one parses clean, then fails while running', () => {
    expect(panelCodes('03-የአሂድ-ስተት.ahadu')).toEqual([]);

    const source = readFileSync(resolve(dir, '03-የአሂድ-ስተት.ahadu'), 'utf8');
    const result = runSource(source);
    expect(result.stoppedAt).toBe('runtime');
    expect(result.errors.map((d) => d.code)).toEqual(['AH3003']);
  });

  it('the runtime one keeps the output it managed before failing', () => {
    const source = readFileSync(resolve(dir, '03-የአሂድ-ስተት.ahadu'), 'utf8');
    const result = runSource(source);
    expect(result.output).toEqual(['ይጀምራል']);
    expect(result.frames.length).toBeGreaterThan(1);
  });

  it('the fix-syntax-first one is stopped by the parser, so its runtime error never fires', () => {
    // The undefined variable below the bad comparison is real, and the point
    // of the example is that you never get to see it.
    const name = '04-አገባብ-መጀመሪያ.ahadu';
    expect(panelCodes(name)).toEqual(['AH2008']);
    expect(runnerCodes(name)).toEqual(['AH2008']);

    const source = readFileSync(resolve(dir, name), 'utf8');
    expect(source).toContain('ያልተገለጸ_ተለዋጭ');
    expect(runSource(source).stoppedAt).toBe('parser');
  });
});

describe('they do not disturb the working corpus', () => {
  it('stays out of the directory the conformance suite reads', () => {
    // loadCases reads `examples/` without recursing, so a subdirectory is
    // skipped — which is the only reason these can exist at all.
    const top = readdirSync(resolve(root, 'examples')).filter((n) => n.endsWith('.ahadu'));
    expect(top.length).toBeGreaterThanOrEqual(8);
    expect(top).not.toContain('01-የቃላት-ስተቶች.ahadu');
  });

  it('every working example still runs clean', () => {
    for (const name of readdirSync(resolve(root, 'examples')).filter((n) => n.endsWith('.ahadu'))) {
      const source = readFileSync(resolve(root, 'examples', name), 'utf8');
      expect(runSource(source, { maxSteps: 200_000 }).errors, name).toEqual([]);
    }
  });
});
