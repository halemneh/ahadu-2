/** Runtime errors, tracebacks and resource limits (LANGUAGE.md §9). */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { code, frames, message, runSource } from '../../helpers/evaluate.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const spec = readFileSync(resolve(root, 'spec/LANGUAGE.md'), 'utf8');
const lines = (...source: string[]): string => source.join('\n');

/** Every AH3xxx code the catalogue defines (§9.2). */
const runtimeCodes = [...spec.matchAll(/^\| `(AH3\d{3})` \|/gm)].map((m) => m[1] as string);

/** A program that triggers each one. */
const triggers: Record<string, string> = {
  AH3001: 'ጻፍ(ያልተገለጸ)',
  AH3002: 'ጻፍ("ሀ" + 1)',
  AH3003: 'ጻፍ(1 / 0)',
  AH3004: 'ጻፍ((0 - 8) ^ 0.5)',
  AH3005: 'ጻፍ(1) ከሆነ፦\n    ጻፍ(2)',
  AH3006: 'ጻፍ(10 ^ 400)',
  AH3007: 'ጻፍ([1][0.5])',
  AH3008: 'ጻፍ([1][5])',
  AH3009: 'ቁጥር ሀ = 1\nሀ = "ለ"',
  AH3010: lines('ተግባር ሀ(ለ)፦', '    ተመላሽ ለ', '', 'ሀ()'),
  AH3011: 'ክላስ ሀ(የለም)፦\n    ለ = 1',
  AH3012: lines('ክላስ ሀ፦', '    ለ = 1', '', 'ነገር = ሀ()', 'ነገር.ሐ = 2'),
  AH3013: 'ሀ = 1\nሀ()',
  AH3014: 'ሀ = 1\nጻፍ(ሀ.ለ)',
  AH3015: 'ስም = "ሰላም"\nስም[0] = "ሀ"',
  AH3017: lines('ተግባር ድ(ቁ)፦', '    ተመላሽ ድ(ቁ + 1)', '', 'ድ(1)'),
  AH3018: 'እውነት እስከሆነ ድረስ፦\n    ሀ = 1',
  AH3019: 'ጻፍ(ወደ_ቁጥር("ሰላም"))',
  AH3020: 'ጻፍ(ዘፈቀደ_ቁጥር(6፣ 1))',
  AH3021: 'ጻፍ(ወደ_ግዕዝ(0))',
  AH3022: 'ጻፍ(ወር_መጠሪያ(14))',
};

describe('the whole runtime catalogue is reachable (§9.2)', () => {
  it('the catalogue was found', () => {
    expect(runtimeCodes.length).toBeGreaterThan(14);
  });

  it('every code has a program that triggers it', () => {
    expect(Object.keys(triggers).sort()).toEqual([...runtimeCodes].sort());
  });

  it.each(runtimeCodes)('%s fires', (expected) => {
    const source = triggers[expected] as string;
    expect(code(source, { maxSteps: 5000 })).toBe(expected);
  });

  it.each(runtimeCodes)('%s carries Amharic text, not just its code', (expected) => {
    const text = message(triggers[expected] as string, { maxSteps: 5000 });
    expect(text).not.toBe(expected);
    expect(text.length).toBeGreaterThan(5);
  });
});

describe('errors stop the program where they happen (§9.3)', () => {
  it('keeps the output produced before the error', () => {
    const result = runSource('ጻፍ("አንድ")\nጻፍ(1 / 0)\nጻፍ("ሶስት")');
    expect(result.output).toEqual(['አንድ']);
    expect(result.errors.map((e) => e.code)).toEqual(['AH3003']);
  });

  it('reports exactly one runtime error — there is no recovery (§9.3)', () => {
    const result = runSource('ጻፍ(1 / 0)\nጻፍ(ያልተገለጸ)');
    expect(result.errors).toHaveLength(1);
  });

  it('points at the span that failed', () => {
    const result = runSource('ሀ = 1\nጻፍ(ሀ / 0)');
    expect(result.errors[0]).toMatchObject({ line: 2, stage: 'runtime' });
  });
});

describe('tracebacks (§9.1)', () => {
  it('names the global frame ዋና ፕሮግራም', () => {
    expect(frames('ጻፍ(1 / 0)')).toEqual(['ዋና ፕሮግራም:1']);
  });

  it('lists frames outermost first, each at the line it was running', () => {
    const source = lines(
      'ተግባር ውስጥ(ቁ)፦',
      '    ተመላሽ ቁ / 0',
      '',
      'ተግባር ውጪ(ቁ)፦',
      '    ተመላሽ ውስጥ(ቁ)',
      '',
      'ጻፍ(ውጪ(5))',
    );
    expect(frames(source)).toEqual(['ዋና ፕሮግራም:7', 'ውጪ:5', 'ውስጥ:2']);
  });

  it('names a constructor frame after its class', () => {
    const source = lines('ክላስ ሀ፦', '    ለ = 1', '', '    ፍጠር()፦', '        ለ = 1 / 0', '', 'ሀ()');
    expect(frames(source)).toEqual(['ዋና ፕሮግራም:7', 'ሀ.ፍጠር:5']);
  });

  it('names a method frame after the method', () => {
    const source = lines(
      'ክላስ ሀ፦',
      '    ለ = 1',
      '',
      '    ተግባር ሐ()፦',
      '        ተመላሽ 1 / 0',
      '',
      'ሀ().ሐ()',
    );
    expect(frames(source)).toEqual(['ዋና ፕሮግራም:7', 'ሐ:5']);
  });

  it('is just the global frame for an error outside any call', () => {
    expect(frames('ጻፍ(ያልተገለጸ)')).toHaveLength(1);
  });

  it('shows the recursion that ran away', () => {
    const source = lines('ተግባር ድ(ቁ)፦', '    ተመላሽ ድ(ቁ + 1)', '', 'ድ(1)');
    const stack = frames(source);
    expect(stack[0]).toBe('ዋና ፕሮግራም:4');
    expect(stack.length).toBeGreaterThan(100);
    expect(stack.at(-1)).toMatch(/^ድ:/);
  });
});

describe('resource limits (§9.2)', () => {
  it('bounds an endless loop when a step budget is given', () => {
    const result = runSource('እውነት እስከሆነ ድረስ፦\n    ሀ = 1', { maxSteps: 500 });
    expect(result.errors.map((e) => e.code)).toEqual(['AH3018']);
    expect(result.errors[0]?.message).toContain('500');
  });

  it('leaves a program alone when it fits the budget', () => {
    const source = lines('ቆጣሪ = 0', 'ቆጣሪ < 10 እስከሆነ ድረስ፦', '    ቆጣሪ = ቆጣሪ + 1', '', 'ጻፍ(ቆጣሪ)');
    const result = runSource(source, { maxSteps: 10000 });
    expect(result.errors).toEqual([]);
    expect(result.output).toEqual(['10']);
  });

  it('bounds recursion by depth', () => {
    const source = lines('ተግባር ድ(ቁ)፦', '    ተመላሽ ድ(ቁ + 1)', '', 'ድ(1)');
    expect(message(source, { maxDepth: 25 })).toContain('25');
  });

  it('allows recursion within the limit', () => {
    const source = lines(
      'ተግባር ቁጥር_ቁጠር(ቁ)፦',
      '    ቁ <= 0 ከሆነ፦',
      '        ተመላሽ 0',
      '    ተመላሽ 1 + ቁጥር_ቁጠር(ቁ - 1)',
      '',
      'ጻፍ(ቁጥር_ቁጠር(50))',
    );
    expect(runSource(source, { maxDepth: 60 }).output).toEqual(['50']);
  });
});

describe('nothing escapes into the host (§9.3)', () => {
  it.each([
    'ጻፍ(1 / 0)',
    'ጻፍ(ያልተገለጸ)',
    'ሀ = 1\nሀ()',
    'ጻፍ([1][99])',
    'ጻፍ(10 ^ 400)',
    'ጻፍ("ሀ" * -1)',
    'ጻፍ(ምንም + ምንም)',
    'እውነት እስከሆነ ድረስ፦\n    ሀ = 1',
  ])('%o comes back as a diagnostic rather than a throw', (source) => {
    expect(() => runSource(source, { maxSteps: 2000 })).not.toThrow();
    expect(runSource(source, { maxSteps: 2000 }).errors).toHaveLength(1);
  });
});
