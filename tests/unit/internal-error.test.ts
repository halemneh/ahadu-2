/**
 * AH9001: when Ahadu itself fails (LANGUAGE.md §9.2, §9.3).
 *
 * A bug in the lexer, parser or interpreter must reach the reader as an
 * Amharic message asking them to report it — never as a JavaScript error or
 * stack trace. These force each stage to fail from the inside and check what
 * comes out.
 */

import { describe, expect, it } from 'vitest';
import { AH9001, MESSAGES, internalCause } from '../../src/diagnostics.js';
import type { Diagnostic } from '../../src/diagnostics.js';
import { tokenize } from '../../src/lexer/index.js';
import { parse } from '../../src/parser/index.js';
import type { Token } from '../../src/lexer/index.js';
import { run } from '../../src/engine.js';
import { evaluate } from '../../tools/playground/evaluate.js';
import type { RunRequest } from '../../tools/playground/evaluate.js';

function expectMasked(d: Diagnostic | undefined): void {
  expect(d?.code).toBe(AH9001);
  expect(d?.message).toBe(MESSAGES[AH9001]);
  // The original error is kept for a developer, but out of sight: it does
  // not serialise, so it cannot reach a page, a worker message or --json.
  expect(internalCause(d as Diagnostic)).toBeInstanceOf(Error);
  expect(JSON.stringify(d)).not.toMatch(/TypeError|Error:|at /);
}

describe('AH9001', () => {
  it('is in Amharic and asks to be reported', () => {
    expect(MESSAGES[AH9001]).toMatch(/ያሳውቁን/);
  });

  it('comes out of a lexer that fails', () => {
    // A value the decoder cannot read throws inside `tokenize`.
    const result = tokenize({} as Uint8Array);
    expectMasked(result.diagnostics[0]);
    expect(result.tokens.at(-1)?.type).toBe('EOF');
  });

  it('comes out of a parser that fails', () => {
    // A token stream with no EOF is not something the lexer can produce.
    const result = parse([] as Token[]);
    expectMasked(result.diagnostics[0]);
    expect(result.program.type).toBe('Program');
  });

  it('comes out of an interpreter whose host fails', () => {
    const { program } = parse(tokenize('ጻፍ(1)').tokens);
    const result = run(program, {
      write: () => {
        throw new TypeError('host broke');
      },
      readLine: () => '',
    });
    expectMasked(result.diagnostic ?? undefined);
  });

  it('comes out of the playground and the site, whatever fails between stages', () => {
    const reply = evaluate({
      source: 'ጻፍ(1)',
      input: null,
      maxSteps: 100,
    } as unknown as RunRequest);
    expect(reply.stoppedAt).toBe('runtime');
    expectMasked(reply.diagnostics[0]);
  });
});
