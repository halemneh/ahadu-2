/**
 * Smoke tests for the `ahadu` command (TOOLING.md §1).
 *
 * These run the built CLI, so they skip when `dist/` is absent — `npm run
 * check` and CI both build before testing.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = resolve(root, 'dist/cli/main.js');
const built = existsSync(cli);

interface Run {
  stdout: string;
  stderr: string;
  status: number;
}

function run(...args: string[]): Run {
  try {
    const stdout = execFileSync('node', [cli, ...args], { cwd: root, encoding: 'utf8' });
    return { stdout, stderr: '', status: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
  }
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
    expect(stdout).toContain('(የ + ሃይሌ)');
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

describe.skipIf(!built)('unimplemented stages say so', () => {
  it.each(['trace'])('%s reports that it is not built yet', (command) => {
    const { status, stderr } = run(command, 'examples/01-ሰላም.ahadu');
    expect(status).toBe(2);
    expect(stderr).toContain('ROADMAP.md');
  });

  it('a bare path points at the tokens subcommand', () => {
    const { status, stderr } = run('examples/01-ሰላም.ahadu');
    expect(status).toBe(2);
    expect(stderr).toContain('ahadu tokens');
  });

  it('--help prints usage and exits 0', () => {
    const { stdout, status } = run('--help');
    expect(status).toBe(0);
    expect(stdout).toContain('ahadu tokens <file>');
  });
});
