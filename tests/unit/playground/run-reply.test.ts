/**
 * What a run reports back, and how the panels show it (TOOLING.md §2).
 *
 * Regression: a file with several problems used to look like it had one. The
 * worker returned only the first diagnostic from the stage that stopped it,
 * and the page then painted that single error *over* the full list the live
 * analysis had already produced.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../../tools/playground/evaluate.js';
import type { RunReply } from '../../../tools/playground/evaluate.js';
import { analyse, diagnosticsHtml, outputHtml, reported } from '../../../tools/playground/view.js';
import { strings } from '../../../tools/playground/strings.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const am = strings('am');
const en = strings('en');

function run(source: string): RunReply {
  return evaluate({ source, input: [], maxSteps: 200_000 });
}

function example(name: string): string {
  return readFileSync(resolve(root, 'examples/errors', name), 'utf8');
}

describe('a run reports every diagnostic from the stage that stopped it', () => {
  it('returns all the lexer found, not just the first', () => {
    const reply = run(example('01-የቃላት-ስተቶች.ahadu'));
    expect(reply.stoppedAt).toBe('lexer');
    expect(reply.diagnostics.length).toBeGreaterThanOrEqual(3);
    expect(new Set(reply.diagnostics.map((d) => d.code)).size).toBeGreaterThanOrEqual(3);
  });

  it('returns all the parser found', () => {
    const reply = run(example('02-የአገባብ-ስተቶች.ahadu'));
    expect(reply.stoppedAt).toBe('parser');
    expect(reply.diagnostics.length).toBeGreaterThanOrEqual(3);
  });

  it('returns exactly one for a runtime error, with its traceback', () => {
    // Evaluation stops at the first error, so this stage is always singular.
    const reply = run(example('03-የአሂድ-ስተት.ahadu'));
    expect(reply.stoppedAt).toBe('runtime');
    expect(reply.diagnostics.map((d) => d.code)).toEqual(['AH3003']);
    expect(reply.frames.length).toBeGreaterThan(1);
  });

  it('keeps the output a program managed before failing', () => {
    expect(run(example('03-የአሂድ-ስተት.ahadu')).output).toContain('ይጀምራል');
  });

  it('serves አንብብ from the input panel, one line per call (§2.2)', () => {
    const reply = evaluate({
      source: 'ጻፍ("ሰላም " + አንብብ())\nጻፍ("እና " + አንብብ())',
      input: ['አበበ', 'ሰላም'],
      maxSteps: 200_000,
    });
    expect(reply.diagnostics).toEqual([]);
    expect(reply.output).toBe('ሰላም አበበ\nእና ሰላም\n');
  });

  it('echoes an አንብብ prompt into the output, as a terminal would', () => {
    const reply = evaluate({
      source: 'ስም = አንብብ("ስም፦ ")\nጻፍ(ስም)',
      input: ['አበበ'],
      maxSteps: 200_000,
    });
    expect(reply.output).toBe('ስም፦ አበበ\n');
  });

  it('gives አንብብ an empty line when the panel runs out', () => {
    const reply = evaluate({ source: 'ጻፍ(ርዝመት(አንብብ()))', input: [], maxSteps: 200_000 });
    expect(reply.output).toBe('0\n');
  });

  it('bounds an endless loop rather than hanging the worker (§2.2)', () => {
    const reply = evaluate({
      source: 'እውነት እስከሆነ ድረስ፦\n    ሀ = 1',
      input: [],
      maxSteps: 500,
    });
    expect(reply.diagnostics.map((d) => d.code)).toEqual(['AH3018']);
  });

  it('reports nothing for a program that runs clean', () => {
    const reply = run('ጻፍ("ሰላም")');
    expect(reply.diagnostics).toEqual([]);
    expect(reply.stoppedAt).toBeNull();
    expect(reply.output).toBe('ሰላም\n');
  });
});

describe('the errors panel shows all of them', () => {
  it('renders one block per diagnostic', () => {
    const source = example('01-የቃላት-ስተቶች.ahadu');
    const entries = reported(analyse(source).diagnostics);
    const html = diagnosticsHtml({ source: source, strings: am }, entries);

    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(html.match(/class="diag"/g)).toHaveLength(entries.length);
  });

  it('shows each code once, in source order', () => {
    const source = example('02-የአገባብ-ስተቶች.ahadu');
    const live = analyse(source).diagnostics;
    const html = diagnosticsHtml({ source, strings: am }, reported(live));

    const shown = [...html.matchAll(/class="code">(AH\d{4})</g)].map((m) => m[1]);
    expect(shown).toEqual(live.map((d) => d.code));
  });

  it('puts a runtime error after the rest, not instead of them', () => {
    // This is the shape the page now paints: the live analysis, then the run.
    const source = 'ሀ = 1';
    const live = analyse(source).diagnostics;
    const runtime = {
      diagnostic: {
        code: 'AH3001',
        message: 'ያልታወቀ ተለዋጭ',
        line: 1,
        startCol: 1,
        endCol: 1,
        stage: 'runtime' as const,
      },
      frames: [
        { name: 'ዋና ፕሮግራም', line: 1 },
        { name: 'ሀ', line: 1 },
      ],
    };

    const html = diagnosticsHtml({ source: source, strings: am }, [...reported(live), runtime]);
    expect(html.match(/class="diag"/g)).toHaveLength(live.length + 1);
    expect(html).toContain('class="code">AH3001<');
    // Only the runtime one carries a traceback.
    expect(html.match(/class="frames"/g)).toHaveLength(1);
  });

  it('says so when there is nothing wrong', () => {
    expect(diagnosticsHtml({ source: 'ሀ = 1', strings: am }, [])).toContain('ምንም ስተት አልተገኘም');
  });
});

describe('the output panel says how many more there are', () => {
  it('counts the rest after the one that stopped the run', () => {
    const reply = run(example('01-የቃላት-ስተቶች.ahadu'));
    const html = outputHtml(reply, en);
    expect(html).toContain(`and ${reply.diagnostics.length - 1} more`);
  });

  it('counts them in Amharic too', () => {
    const reply = run(example('02-የአገባብ-ስተቶች.ahadu'));
    expect(outputHtml(reply, am)).toContain('ተጨማሪ');
  });

  it('says nothing extra when there is only one', () => {
    const reply = run(example('03-የአሂድ-ስተት.ahadu'));
    expect(reply.diagnostics).toHaveLength(1);
    expect(outputHtml(reply, en)).not.toContain('more');
  });

  it('shows the value instead when a program succeeds', () => {
    expect(outputHtml(run('1 + 2'), en)).toContain('Value: 3');
  });
});
