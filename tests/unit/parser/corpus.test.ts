/**
 * M2's acceptance test: every example and every conformance case through the
 * parser, checked against what each case's header claims.
 *
 * Also checks that the spec's error catalogue (§9.2) is actually exercised —
 * a code that exists only in the document is a promise nothing keeps.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { parse } from '../../../src/parser/index.js';
import { loadCases } from '../../conformance/harness.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cases = loadCases(resolve(root, 'tests/conformance/cases'));
const examples = loadCases(resolve(root, 'examples'));
const spec = readFileSync(resolve(root, 'spec/LANGUAGE.md'), 'utf8');

/** Codes a case expects from a given stage. */
function expectedFrom(codes: string[], prefix: string): string[] {
  return codes.filter((c) => c.startsWith(prefix));
}

describe('conformance cases parse as their headers claim', () => {
  it.each(cases)('$name', (c) => {
    const lexed = tokenize(c.source);
    const expectedCodes = c.expectedErrors.map((e) => e.code);

    // A case that expects a lexical error says nothing about parsing: a
    // runner stops at the first stage that reports (§9.3), so the parser
    // never sees that token stream in anger.
    if (expectedFrom(expectedCodes, 'AH1').length > 0) {
      expect(lexed.diagnostics.length).toBeGreaterThan(0);
      return;
    }

    expect(lexed.diagnostics).toEqual([]);
    const { program, diagnostics } = parse(lexed.tokens);

    expect(diagnostics.map((d) => d.code)).toEqual(expectedFrom(expectedCodes, 'AH2'));
    expect(program.type).toBe('Program');

    // Anything expecting a runtime error has to get through the parser first.
    if (expectedFrom(expectedCodes, 'AH3').length > 0) {
      expect(diagnostics).toEqual([]);
      expect(program.body.length).toBeGreaterThan(0);
    }
  });

  it.each(cases)('$name positions point inside the source', (c) => {
    const lines = c.source.split(/\r\n|\r|\n/);
    const lexed = tokenize(c.source);
    if (lexed.diagnostics.length > 0) return;

    for (const d of parse(lexed.tokens).diagnostics) {
      const line = lines[d.line - 1];
      expect(line, `${c.name} line ${d.line}`).toBeDefined();
      expect(d.startCol).toBeGreaterThanOrEqual(1);
      expect(d.endCol).toBeGreaterThanOrEqual(d.startCol);
      // One past the last character is a legal place to point: that is where
      // a token the parser wanted and did not get would have gone.
      expect(d.startCol).toBeLessThanOrEqual(Math.max(1, [...(line ?? '')].length) + 1);
    }
  });
});

describe('example programs parse clean', () => {
  it.each(examples)('$name', (c) => {
    const lexed = tokenize(c.source);
    expect(lexed.diagnostics).toEqual([]);

    const { program, diagnostics } = parse(lexed.tokens);
    expect(diagnostics.map((d) => `${d.code} ${d.line}:${d.startCol} ${d.message}`)).toEqual([]);
    expect(program.body.length).toBeGreaterThan(0);
  });

  it('reads the family program the way the original wrote it', () => {
    // Condition-first throughout — the shape v1-ts could not parse at all
    // (CHANGES C01).
    const source = readFileSync(resolve(root, 'examples/03-ቤተሰብ.ahadu'), 'utf8');
    const { program, diagnostics } = parse(tokenize(source).tokens);
    expect(diagnostics).toEqual([]);

    const fn = program.body.find((s) => s.type === 'FunctionDeclaration');
    expect(fn).toBeDefined();
    if (fn?.type !== 'FunctionDeclaration') return;

    const loop = fn.body.statements[1];
    expect(loop?.type).toBe('WhileStatement');
    if (loop?.type !== 'WhileStatement') return;

    const conditional = loop.body.statements[1];
    expect(conditional?.type).toBe('IfStatement');
    if (conditional?.type !== 'IfStatement') return;
    expect(conditional.elifs).toHaveLength(1);
    expect(conditional.alternate).not.toBeNull();
  });
});

describe('the spec error catalogue is exercised (§9.2)', () => {
  /** Codes listed in the §9.2 table. */
  const catalogue = [...spec.matchAll(/^\| `(AH\d{4})` \|/gm)].map((m) => m[1] as string);

  const exercised = new Set(cases.flatMap((c) => c.expectedErrors.map((e) => e.code)));

  it('the catalogue was found', () => {
    expect(catalogue.length).toBeGreaterThan(30);
  });

  it('every lexical code has a conformance case', () => {
    const missing = catalogue.filter((c) => c.startsWith('AH1') && !exercised.has(c));
    expect(missing).toEqual([]);
  });

  it('every syntactic code has a conformance case', () => {
    const missing = catalogue.filter((c) => c.startsWith('AH2') && !exercised.has(c));
    expect(missing).toEqual([]);
  });

  it('every runtime code has a conformance case', () => {
    const missing = catalogue.filter((c) => c.startsWith('AH3') && !exercised.has(c));
    expect(missing).toEqual([]);
  });

  it('no case expects a code the spec does not define', () => {
    const unknown = [...exercised].filter((c) => !catalogue.includes(c));
    expect(unknown).toEqual([]);
  });
});

/** See the note in tests/unit/lexer/corpus.test.ts; same reasoning. */
const CEILING_MS = 1000;

describe('performance budget (TOOLING.md §1.5)', () => {
  it('parses a 1,000-line program without any sign of a quadratic', () => {
    const block = [
      'ተግባር ተግባር_N(ሀ፣ ለ)፦',
      '    ሀ > ለ ከሆነ፦',
      '        ተመላሽ ሀ + ለ * 2',
      '    ግን ሀ == ለ ከሆነ፦',
      '        ተመላሽ 0',
      '    አለበለዚያ፦',
      '        ተመላሽ ለ',
      '',
    ].join('\n');
    const source = block.repeat(125); // ~1,000 lines

    const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
    expect(lexDiagnostics).toEqual([]);

    const started = performance.now();
    const { program, diagnostics } = parse(tokens);
    const elapsed = performance.now() - started;

    expect(diagnostics).toEqual([]);
    expect(program.body).toHaveLength(125);
    expect(elapsed).toBeLessThan(CEILING_MS);
  });
});
