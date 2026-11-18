/**
 * Lexes every example program and every conformance case, and checks the
 * lexer-stage diagnostics against what each case's header claims.
 *
 * This is M1's acceptance test. A case whose header expects an `AH1xxx` code
 * must produce exactly that; every other case — whether it expects output, a
 * parse error, or a runtime error — must lex completely clean.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { loadCases } from '../../conformance/harness.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cases = loadCases(resolve(root, 'tests/conformance/cases'));
const examples = loadCases(resolve(root, 'examples'));

/** The codes this stage is responsible for. */
function lexicalCodes(codes: string[]): string[] {
  return codes.filter((c) => c.startsWith('AH1'));
}

describe('conformance cases lex as their headers claim', () => {
  it('the corpus was found', () => {
    expect(cases.length).toBeGreaterThan(30);
  });

  it.each(cases)('$name', (c) => {
    const { tokens, diagnostics } = tokenize(c.source);
    const expected = lexicalCodes(c.expectedErrors.map((e) => e.code));

    expect(diagnostics.map((d) => d.code)).toEqual(expected);
    expect(tokens.at(-1)?.type).toBe('EOF');
  });

  it.each(cases)('$name positions resolve to real source', (c) => {
    const lines = c.source.split(/\r\n|\r|\n/);
    for (const d of tokenize(c.source).diagnostics) {
      const line = lines[d.line - 1];
      expect(line, `${c.name} line ${d.line}`).toBeDefined();
      expect(d.startCol).toBeGreaterThanOrEqual(1);
      expect(d.endCol).toBeGreaterThanOrEqual(d.startCol);
      // A span may end one past the last column only for an empty line.
      expect(d.startCol).toBeLessThanOrEqual(Math.max(1, [...(line ?? '')].length));
    }
  });
});

describe('example programs lex clean', () => {
  it('the examples were found', () => {
    expect(examples.length).toBeGreaterThanOrEqual(7);
  });

  it.each(examples)('$name', (c) => {
    const { tokens, diagnostics } = tokenize(c.source);
    expect(diagnostics).toEqual([]);
    expect(tokens.length).toBeGreaterThan(1);
  });

  it('produces the expected token kinds for the hello program', () => {
    const hello = examples.find((e) => e.name.includes('ሰላም'));
    expect(hello).toBeDefined();
    expect(tokenize(hello?.source ?? '').tokens.map((t) => t.type)).toEqual([
      'NEWLINE', // the file opens with a comment line
      'IDENTIFIER',
      'LPAREN',
      'STRING',
      'RPAREN',
      'NEWLINE',
      'EOF',
    ]);
  });
});

describe('performance budget (TOOLING.md §1.5)', () => {
  it('lexes a 1,000-line program in well under 50ms', () => {
    const line = 'ቆጣሪ = ቆጣሪ + ርዝመት("ሰላም ዓለም") * ፳፩\n';
    const source = line.repeat(1000);

    const started = performance.now();
    const { tokens, diagnostics } = tokenize(source);
    const elapsed = performance.now() - started;

    expect(diagnostics).toEqual([]);
    expect(tokens.length).toBeGreaterThan(10000);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('legacy programs from the original repository', () => {
  // The v1-py examples, in 2.0 syntax. These are the programs that do not
  // parse under v1-ts at all (CHANGES C01) — the lexer at least has to see
  // them whole.
  const legacy = readFileSync(resolve(root, 'examples/03-ቤተሰብ.ahadu'), 'utf8');

  it('lexes the family program with no diagnostics', () => {
    expect(tokenize(legacy).diagnostics).toEqual([]);
  });

  it('puts the condition before the keyword in the token stream', () => {
    const { tokens } = tokenize('ስም == "መልኬ" ከሆነ፦');
    expect(tokens.map((t) => t.type)).toEqual([
      'IDENTIFIER',
      'EQ',
      'STRING',
      'KEYWORD',
      'THEN',
      'EOF',
    ]);
  });
});
