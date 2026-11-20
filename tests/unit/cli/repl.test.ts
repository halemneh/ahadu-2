/**
 * The REPL (TOOLING.md §1.2).
 *
 * Driven through its injected I/O rather than by spawning a process, so a
 * session is an ordinary function call and its output an ordinary value.
 */

import { describe, expect, it } from 'vitest';
import { inspectEntry, runRepl } from '../../../src/cli/repl.js';
import type { ReplIo } from '../../../src/cli/repl.js';

interface Session {
  /** Everything written to the session's output, prompts stripped. */
  out: string[];
  /** Everything written as a diagnostic or notice. */
  err: string[];
  status: number;
}

/**
 * Runs a session over scripted input lines.
 *
 * Input runs out rather than ending explicitly, which is what Ctrl-D does.
 */
function session(...input: string[]): Session {
  const out: string[] = [];
  const err: string[] = [];
  const pending = [...input];

  const io: ReplIo = {
    write: (text) => {
      out.push(text);
    },
    writeError: (text) => {
      err.push(text);
    },
    readLine: () => pending.shift() ?? null,
  };

  const status = runRepl(io, { maxSteps: 100_000 });
  return { out, err, status };
}

/** The session's output as lines, dropping the banner and blank padding. */
function lines(s: Session): string[] {
  return s.out
    .join('')
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('አሃዱ 2.0'));
}

function errorCodes(s: Session): string[] {
  return s.err.flatMap((text) => [...text.matchAll(/\[(AH\d{4})\]/g)].map((m) => m[1] as string));
}

describe('evaluating entries (§1.2)', () => {
  it('prints the value of an expression', () => {
    expect(lines(session('1 + 2'))).toEqual(['3']);
  });

  it('prints nothing for a statement that evaluates to ምንም', () => {
    expect(lines(session('ሀ = 1'))).toEqual([]);
    expect(lines(session('ተግባር ሀ()፦', '    ተመላሽ 1', ''))).toEqual([]);
  });

  it('prints what ጻፍ wrote, and no value after it', () => {
    expect(lines(session('ጻፍ("ሰላም")'))).toEqual(['ሰላም']);
  });

  it('keeps bindings across entries', () => {
    expect(lines(session('ሀ = 5', 'ሀ + 2'))).toEqual(['7']);
  });

  it('keeps a function across entries', () => {
    const s = session('ተግባር እጥፍ(ቁ)፦', '    ተመላሽ ቁ * 2', '', 'እጥፍ(21)');
    expect(lines(s)).toEqual(['42']);
  });

  it('ignores a blank line on its own', () => {
    expect(lines(session('', '', '1'))).toEqual(['1']);
  });

  it('exits cleanly when input runs out, as Ctrl-D does', () => {
    expect(session('1').status).toBe(0);
  });
});

describe('blocks (§1.2)', () => {
  it('reads an indented block until a blank line', () => {
    const s = session('እውነት ከሆነ፦', '    ጻፍ("ውስጥ")', '');
    expect(lines(s)).toEqual(['ውስጥ']);
    expect(errorCodes(s)).toEqual([]);
  });

  it('keeps reading past a line that would look complete on its own', () => {
    // The ጻፍ line ends in a closing paren, which is a complete statement —
    // but the block it is in has not finished.
    const s = session('ዕድሜ = 20', 'ዕድሜ > 18 ከሆነ፦', '    ጻፍ("ትልቅ")', 'አለበለዚያ፦', '    ጻፍ("ልጅ")', '');
    expect(lines(s)).toEqual(['ትልቅ']);
    expect(errorCodes(s)).toEqual([]);
  });

  it('reads a class declaration whole', () => {
    const s = session('ክላስ ተማሪ፦', '    ጽሁፍ ስም = "አበበ"', '', 'ተማሪ().ስም');
    expect(lines(s)).toEqual(['አበበ']);
    expect(errorCodes(s)).toEqual([]);
  });

  it('evaluates an unfinished block at end of input', () => {
    const s = session('እውነት ከሆነ፦', '    ጻፍ("ውስጥ")');
    expect(lines(s)).toEqual(['ውስጥ']);
  });

  it('closes a bracket without needing a blank line', () => {
    const s = session('ጻፍ(', '    "ባለብዙ"', ')');
    expect(lines(s)).toEqual(['ባለብዙ']);
  });

  it('does not treat a : inside brackets as a block opener', () => {
    expect(lines(session('[1፣ 2፣ 3][0:2]'))).toEqual(['[1፣ 2]']);
  });
});

describe('errors leave the session alive (§1.2)', () => {
  it('reports a runtime error and carries on', () => {
    const s = session('1 / 0', '1 + 1');
    expect(errorCodes(s)).toEqual(['AH3003']);
    expect(lines(s)).toEqual(['2']);
  });

  it('reports a parse error and carries on', () => {
    const s = session('ሀ < ለ < ሐ', '2 + 2');
    expect(errorCodes(s)).toEqual(['AH2008']);
    expect(lines(s)).toEqual(['4']);
  });

  it('reports a lexical error and carries on', () => {
    const s = session('ሀ = 1 $ 2', '3');
    expect(errorCodes(s)).toEqual(['AH1001']);
    expect(lines(s)).toEqual(['3']);
  });

  it('keeps bindings made before the error', () => {
    expect(lines(session('ሀ = 5', '1 / 0', 'ሀ'))).toEqual(['5']);
  });

  it('shows the source line and a caret', () => {
    const s = session('1 / 0');
    expect(s.err.join('')).toContain('1 / 0');
    expect(s.err.join('')).toContain('^');
  });

  it('shows a traceback for an error inside a call', () => {
    const s = session('ተግባር ሀ()፦', '    ተመላሽ 1 / 0', '', 'ሀ()');
    expect(s.err.join('')).toContain('የጥሪ መልሶ ምልከታ');
    expect(s.err.join('')).toContain('ዋና ፕሮግራም');
  });
});

describe('meta-commands (§1.2)', () => {
  it(':quit ends the session', () => {
    const s = session(':quit', '999');
    expect(s.status).toBe(0);
    expect(lines(s)).toEqual([]);
  });

  it(':q is the same', () => {
    expect(session(':q', '999').status).toBe(0);
  });

  it(':help lists the commands', () => {
    const text = session(':help').out.join('');
    expect(text).toContain(':tokens');
    expect(text).toContain(':ast');
    expect(text).toContain(':clear');
    expect(text).toContain(':quit');
  });

  it(':clear forgets the bindings', () => {
    const s = session('ሀ = 1', ':clear', 'ሀ');
    expect(errorCodes(s)).toEqual(['AH3001']);
  });

  it(':tokens prints the token table', () => {
    const text = session(':tokens ሀ + 1').out.join('');
    expect(text).toContain('IDENTIFIER:ሀ');
    expect(text).toContain('PLUS');
    expect(text).toContain('NUMBER:1');
  });

  it(':ast prints the tree', () => {
    const text = session(':ast ሀ + 1').out.join('');
    expect(text).toContain('BinaryExpression ADD');
    expect(text).toContain('left: Identifier ሀ');
  });

  it(':tokens and :ast need something to work on', () => {
    expect(session(':tokens').err.join('')).toContain(':tokens');
    expect(session(':ast').err.join('')).toContain(':ast');
  });

  it(':ast reports a lexical problem rather than a tree', () => {
    const s = session(':ast $');
    expect(errorCodes(s)).toEqual(['AH1001']);
  });

  it('names an unknown command', () => {
    expect(session(':nope').err.join('')).toContain(':nope');
  });

  it('is only a command at the start of an entry', () => {
    // Inside a block, a leading : is ordinary Ahadu — and wrong here, which
    // is a parse error rather than a meta-command.
    const s = session('እውነት ከሆነ፦', ':help', '');
    expect(session(':help').out.join('')).toContain(':tokens');
    expect(errorCodes(s).length).toBeGreaterThan(0);
  });
});

describe('አንብብ reads from the session (§8)', () => {
  it('takes the next input line', () => {
    const s = session('ስም = አንብብ()', 'ተስፋማርያም', 'ጻፍ("ሰላም " + ስም)');
    expect(lines(s)).toEqual(['ሰላም ተስፋማርያም']);
  });
});

describe('inspectEntry', () => {
  it.each([
    ['1 + 1', false, false],
    ['እውነት ከሆነ፦', false, true],
    ['እውነት ከሆነ:-', false, true],
    ['ጻፍ(', true, false],
    ['ጻፍ(1)', false, false],
    ['[1፣', true, false],
    ['ዝ[0:2]', false, false],
    ['ተግባር ሀ()፦', false, true],
  ])('%s → bracket %s, block %s', (source, openBracket, opensBlock) => {
    expect(inspectEntry(source)).toEqual({ openBracket, opensBlock });
  });

  it('sees a block opener across several lines', () => {
    expect(inspectEntry('ሀ = 1\nእውነት ከሆነ፦').opensBlock).toBe(true);
  });

  it('is not confused by a complete block body', () => {
    expect(inspectEntry('እውነት ከሆነ፦\n    ጻፍ(1)')).toEqual({
      openBracket: false,
      opensBlock: false,
    });
  });
});
