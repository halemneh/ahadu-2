/**
 * Smoke tests for the `ahadu` command (TOOLING.md §1).
 *
 * These run the built CLI, so they skip when `dist/` is absent — `npm run
 * check` and CI both build before testing.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cli = resolve(root, 'dist/cli/main.js');
const built = existsSync(cli);

interface Run {
  stdout: string;
  stderr: string;
  status: number;
}

function runWithInput(input: string, ...args: string[]): Run {
  const result = spawnSync('node', [cli, ...args], { cwd: root, encoding: 'utf8', input });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

function run(...args: string[]): Run {
  // spawnSync rather than execFileSync, which returns stdout alone and so
  // cannot see what a successful run wrote to stderr — `ahadu trace` does.
  const result = spawnSync('node', [cli, ...args], { cwd: root, encoding: 'utf8' });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

describe.skipIf(!built)('ahadu tokens', () => {
  it('prints a token table for an example program', () => {
    const { stdout, status } = run('tokens', 'examples/01-ሰላም.ahadu');
    expect(status).toBe(0);
    expect(stdout).toContain('IDENTIFIER ጻፍ');
    expect(stdout).toContain('STRING     ሰላም ዓለም!');
    expect(stdout).toContain('ቶከኖች');
  });

  it('marks a የ-prefixed name with its stem', () => {
    const { stdout } = run('tokens', 'examples/05-ክላስ.ahadu');
    expect(stdout).toContain('(የ + ተማሪው)');
  });

  it('exits 1 and writes a framed diagnostic to stderr', () => {
    const { stderr, status } = run(
      'tokens',
      'tests/conformance/cases/106-while-without-dires.ahadu',
    );
    expect(status).toBe(1);
    expect(stderr).toContain('[AH1004]');
    expect(stderr).toContain('መስመር 4 ላይ');
    expect(stderr).toContain('^');
  });

  it('keeps diagnostics off stdout, so program output stays clean', () => {
    const { stdout } = run('tokens', 'tests/conformance/cases/112-unterminated-string.ahadu');
    expect(stdout).not.toContain('AH1003');
  });

  it('emits JSON with --json', () => {
    const { stdout } = run('tokens', 'examples/01-ሰላም.ahadu', '--json');
    const parsed = JSON.parse(stdout) as { tokens: unknown[]; diagnostics: unknown[] };
    expect(parsed.tokens.length).toBeGreaterThan(3);
    expect(parsed.diagnostics).toEqual([]);
  });

  it('exits 2 when the file does not exist', () => {
    const { status, stderr } = run('tokens', 'no-such-file.ahadu');
    expect(status).toBe(2);
    expect(stderr).toContain('አልተገኘም');
  });

  it('exits 2 when no file is given', () => {
    expect(run('tokens').status).toBe(2);
  });
});

describe.skipIf(!built)('ahadu ast', () => {
  it('prints an indented tree with spans', () => {
    const { stdout, status } = run('ast', 'examples/01-ሰላም.ahadu');
    expect(status).toBe(0);
    expect(stdout).toContain('Program [');
    expect(stdout).toContain('ExpressionStatement');
    expect(stdout).toContain('callee: Identifier ጻፍ');
    expect(stdout).toContain('└─');
  });

  it('shows a conditional with the condition before the keyword', () => {
    const { stdout } = run('ast', 'examples/03-ቤተሰብ.ahadu');
    expect(stdout).toContain('IfStatement');
    expect(stdout).toContain('condition: BinaryExpression EQ');
    expect(stdout).toContain('elif[0].condition');
    expect(stdout).toContain('alternate');
  });

  it('marks the የ spelling of a member access', () => {
    const { stdout } = run('ast', 'examples/05-ክላስ.ahadu');
    expect(stdout).toContain('(የ)');
  });

  it('separates a class into attributes, constructor and methods', () => {
    const { stdout } = run('ast', 'examples/05-ክላስ.ahadu');
    expect(stdout).toContain('ClassDeclaration ተማሪ');
    expect(stdout).toContain('attributes:');
    expect(stdout).toContain('constructor:');
    expect(stdout).toContain('methods:');
  });

  it('emits JSON with --json', () => {
    const { stdout } = run('ast', 'examples/01-ሰላም.ahadu', '--json');
    const parsed = JSON.parse(stdout) as { program: { type: string }; diagnostics: unknown[] };
    expect(parsed.program.type).toBe('Program');
    expect(parsed.diagnostics).toEqual([]);
  });

  it('stops at the lexer when the lexer reported', () => {
    // A runner does not parse a token stream it already knows is wrong (§9.3).
    const { stdout, stderr, status } = run(
      'ast',
      'tests/conformance/cases/112-unterminated-string.ahadu',
    );
    expect(status).toBe(1);
    expect(stderr).toContain('[AH1003]');
    expect(stdout).not.toContain('Program [');
  });
});

describe.skipIf(!built)('ahadu check', () => {
  it('says so when a program is clean', () => {
    const { stdout, status } = run('check', 'examples/06-ውርስ.ahadu');
    expect(status).toBe(0);
    expect(stdout).toContain('ምንም ስተት አልተገኘም');
  });

  it('exits 1 and frames a parse error', () => {
    const { stderr, status } = run(
      'check',
      'tests/conformance/cases/122-condition-after-keyword.ahadu',
    );
    expect(status).toBe(1);
    expect(stderr).toContain('[AH2001]');
    expect(stderr).toContain('ሁኔታው ከ"ከሆነ" በፊት');
  });

  it('reports lexer problems too', () => {
    const { stderr, status } = run('check', 'tests/conformance/cases/111-indentation.ahadu');
    expect(status).toBe(1);
    expect(stderr).toContain('[AH1002]');
  });

  it('emits JSON with --json', () => {
    const { stdout } = run(
      'check',
      'tests/conformance/cases/105-chained-comparison.ahadu',
      '--json',
    );
    const parsed = JSON.parse(stdout) as { diagnostics: { code: string }[] };
    expect(parsed.diagnostics.map((d) => d.code)).toEqual(['AH2008']);
  });
});

describe.skipIf(!built)('ahadu run', () => {
  it('runs a program given as a bare path', () => {
    const { stdout, status } = run('examples/01-ሰላም.ahadu');
    expect(status).toBe(0);
    expect(stdout).toBe('ሰላም ዓለም!\n');
  });

  it('runs the family program the original repository shipped', () => {
    // Condition-first if/elif/else in a loop in a function — the program
    // v1-ts could not parse at all (CHANGES C01).
    const { stdout, status } = run('examples/03-ቤተሰብ.ahadu');
    expect(status).toBe(0);
    expect(stdout.trim().split('\n')).toEqual([
      'ልጅ፡ አበበ',
      'ልጅ፡ ትዕግስት',
      'እናት፡ አልማዝ',
      'አባት፡ ከበደ',
      'ልጅ፡ ሰናይት',
    ]);
  });

  it('runs classes with inheritance and dynamic dispatch', () => {
    const { stdout, status } = run('examples/06-ውርስ.ahadu');
    expect(status).toBe(0);
    expect(stdout.trim().split('\n')).toEqual(['ጆሮ ይላል፦ ውው!', 'ሚሚ ይላል፦ ሚያው!']);
  });

  it('keeps program output on stdout and diagnostics on stderr (§1.4)', () => {
    const { stdout, stderr, status } = run('tests/conformance/cases/101-division-by-zero.ahadu');
    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('[AH3003]');
  });

  it('prints a traceback for an error inside a call (§9.1)', () => {
    const { stderr } = run('tests/conformance/cases/140-runaway-recursion.ahadu');
    expect(stderr).toContain('የጥሪ መልሶ ምልከታ');
    expect(stderr).toContain('ዋና ፕሮግራም');
  });

  it('stops before running when the parser reported', () => {
    const { stdout, stderr, status } = run(
      'tests/conformance/cases/122-condition-after-keyword.ahadu',
    );
    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('[AH2001]');
  });
});

describe.skipIf(!built)('ahadu trace', () => {
  it('prints each statement with the value worth showing', () => {
    const { stderr, stdout, status } = run('trace', 'examples/02-ዑደት.ahadu');
    expect(status).toBe(0);
    // Program output still goes to stdout; the trace goes to stderr.
    expect(stdout.trim().split('\n')).toEqual(['1', '2', '3', '4', '5']);
    // An assignment shows the value assigned, not the ምንም it evaluates to.
    expect(stderr).toContain('ቆጣሪ = ቆጣሪ + 1 → 1');
    expect(stderr).toContain('ቆጣሪ = ቆጣሪ + 1 → 5');
  });

  it('shows a return, the most interesting line in a function', () => {
    const { stderr } = run('trace', 'examples/04-ተግባሮች.ahadu');
    expect(stderr).toContain('ተመላሽ ሀ → 12');
  });

  it('indents a statement by how deep in calls it is', () => {
    const { stderr } = run('trace', 'examples/04-ተግባሮች.ahadu');
    expect(stderr).toMatch(/\n {6,}\d+: /);
  });
});

describe.skipIf(!built)('the REPL end to end', () => {
  it('starts, evaluates, and exits on :quit', () => {
    const { stdout, status } = runWithInput('ሀ = 5\nሀ + 2\n:quit\n');
    expect(status).toBe(0);
    expect(stdout).toContain('7');
  });

  it('reads Ethiopic input correctly', () => {
    // Decoding stdin a byte at a time would turn every three-byte Ethiopic
    // character into three replacement characters.
    const { stdout } = runWithInput('ጻፍ("ተስፋማርያም")\n:quit\n');
    expect(stdout).toContain('ተስፋማርያም');
    expect(stdout).not.toContain('\uFFFD');
  });

  it('reads a block until a blank line', () => {
    const input = 'ዕድሜ = 20\nዕድሜ > 18 ከሆነ፦\n    ጻፍ("ትልቅ")\nአለበለዚያ፦\n    ጻፍ("ልጅ")\n\n:quit\n';
    const { stdout, stderr } = runWithInput(input);
    expect(stdout).toContain('ትልቅ');
    expect(stderr).not.toContain('[AH');
  });

  it('serves አንብብ from the session input', () => {
    const { stdout } = runWithInput('ጻፍ(አንብብ("ስም፦ "))\nአበበ\n:quit\n');
    expect(stdout).toContain('አበበ');
  });
});

describe.skipIf(!built)('global flags', () => {
  it('emits no escape sequences when output is not a terminal', () => {
    // spawnSync gives pipes, not a tty, so colour is off either way.
    const { stdout, stderr } = run('check', 'tests/conformance/cases/105-chained-comparison.ahadu');
    expect(stdout).not.toContain('\u001B[');
    expect(stderr).not.toContain('\u001B[');
  });

  it('accepts --no-color without changing plain output', () => {
    const bare = run('check', 'examples/01-ሰላም.ahadu');
    const flagged = run('check', 'examples/01-ሰላም.ahadu', '--no-color');
    expect(flagged.stdout).toBe(bare.stdout);
    expect(flagged.status).toBe(bare.status);
  });

  it('--help exits 0 and lists the REPL', () => {
    const { stdout, status } = run('--help');
    expect(status).toBe(0);
    expect(stdout).toContain('start the REPL');
    expect(stdout).toContain('--no-color');
  });

  it('--help prints usage and exits 0', () => {
    const { stdout, status } = run('--help');
    expect(status).toBe(0);
    expect(stdout).toContain('ahadu tokens <file>');
  });
});
