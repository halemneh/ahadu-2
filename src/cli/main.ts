#!/usr/bin/env node
/**
 * The `ahadu` command (TOOLING.md §1).
 *
 * Only the stages that exist are wired up. `tokens` works today; the rest
 * report what is still missing rather than pretending, so the command never
 * misleads about how far the implementation has got.
 *
 * Program output goes to stdout and diagnostics to stderr, so redirecting
 * stdout captures exactly what a program printed (TOOLING.md §1.4).
 */

import { readFileSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';
import { formatDiagnostic } from '../diagnostics.js';
import type { Diagnostic } from '../diagnostics.js';
import { tokenize } from '../lexer/index.js';
import type { Token } from '../lexer/index.js';
import { parse, printAst } from '../parser/index.js';

const USAGE = `አሃዱ — Ahadu ${'2.0'}

  ahadu tokens <file>    the lexer's output as a table
  ahadu ast <file>       the parse tree
  ahadu check <file>     report diagnostics, exit 1 if there are any
  ahadu <file>           run a program            (not implemented yet — M3)
  ahadu trace <file>     run, printing each step  (not implemented yet — M3)
  ahadu                  REPL                     (not implemented yet — M4)

  --json                 machine-readable output
  --help                 this message

See spec/TOOLING.md for the full design, ROADMAP.md for what lands when.
`;

/** Renders one source line with a caret under the offending span (§9.1). */
function frame(source: string, d: Diagnostic): string {
  const line = source.split(/\r\n|\r|\n/)[d.line - 1] ?? '';
  const gutter = `${d.line}`;
  const pad = ' '.repeat(gutter.length + 2 + Math.max(0, d.startCol - 1));
  const carets = '^'.repeat(Math.max(1, d.endCol - d.startCol + 1));
  return `\n    ${gutter}: ${line}\n    ${pad}${carets}\n`;
}

function reportDiagnostics(source: string, diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics) {
    stderr.write(`${formatDiagnostic(d)}\n${frame(source, d)}\n`);
  }
}

function tokenRow(t: Token): string {
  const span = `${t.line}:${t.startCol}-${t.endCol}`.padEnd(12);
  const type = t.type.padEnd(11);
  const value = t.value === null ? '' : String(t.value);
  const of = t.hasOfPrefix === true ? `  (የ + ${String(t.stem)})` : '';
  return `  ${span}${type}${value}${of}`;
}

/** Reads a file, or null after reporting that it could not be read. */
function read(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    stderr.write(`ፋይሉ አልተገኘም፦ ${path}\n`);
    return null;
  }
}

function cmdTokens(source: string, json: boolean): number {
  const { tokens, diagnostics } = tokenize(source);

  if (json) {
    stdout.write(`${JSON.stringify({ tokens, diagnostics }, null, 2)}\n`);
  } else {
    for (const t of tokens) stdout.write(`${tokenRow(t)}\n`);
    stdout.write(`\n  ${tokens.length} ቶከኖች`);
    stdout.write(diagnostics.length > 0 ? `, ${diagnostics.length} ስተቶች\n` : '\n');
    reportDiagnostics(source, diagnostics);
  }

  return diagnostics.length > 0 ? 1 : 0;
}

/**
 * A runner stops at the first stage that reports. Lexing problems make the
 * token stream untrustworthy, so parsing it would only pile guesses on top of
 * a known error (§9.3). An editor asks each stage directly instead.
 */
function cmdAst(source: string, json: boolean): number {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    reportDiagnostics(source, lexed.diagnostics);
    return 1;
  }

  const { program, diagnostics } = parse(lexed.tokens);

  if (json) {
    stdout.write(`${JSON.stringify({ program, diagnostics }, null, 2)}\n`);
  } else {
    stdout.write(`${printAst(program)}\n`);
    if (diagnostics.length > 0) reportDiagnostics(source, diagnostics);
  }

  return diagnostics.length > 0 ? 1 : 0;
}

function cmdCheck(source: string, json: boolean): number {
  const lexed = tokenize(source);
  const diagnostics =
    lexed.diagnostics.length > 0 ? lexed.diagnostics : parse(lexed.tokens).diagnostics;

  if (json) {
    stdout.write(`${JSON.stringify({ diagnostics }, null, 2)}\n`);
  } else if (diagnostics.length === 0) {
    stdout.write('ምንም ስተት አልተገኘም።\n');
  } else {
    reportDiagnostics(source, diagnostics);
    stderr.write(`${diagnostics.length} ስተት${diagnostics.length > 1 ? 'ች' : ''}\n`);
  }

  return diagnostics.length > 0 ? 1 : 0;
}

function main(args: string[]): number {
  const json = args.includes('--json');
  const rest = args.filter((a) => !a.startsWith('--'));

  if (args.includes('--help') || (rest.length === 0 && args.length > 0)) {
    stdout.write(USAGE);
    return 0;
  }

  const [command, ...operands] = rest;

  const stages: Record<string, ((source: string, json: boolean) => number) | undefined> = {
    tokens: cmdTokens,
    ast: cmdAst,
    check: cmdCheck,
  };

  const stage = command === undefined ? undefined : stages[command];
  if (stage !== undefined) {
    const path = operands[0];
    if (path === undefined) {
      stderr.write(`የፋይል ስም ያስፈልጋል፦ ahadu ${String(command)} <file>\n`);
      return 2;
    }
    const source = read(path);
    if (source === null) return 2;
    return stage(source, json);
  }

  if (command === undefined) {
    stdout.write(USAGE);
    stderr.write('REPL እስካሁን አልተሰራም። (M4 — ROADMAP.md)\n');
    return 2;
  }

  if (['trace', 'run'].includes(command)) {
    stderr.write(`"${command}" እስካሁን አልተሰራም። (ROADMAP.md)\n`);
    return 2;
  }

  // A bare path means "run this", which needs the evaluator.
  stderr.write(`ፕሮግራም ማስኬድ እስካሁን አልተሰራም። (M3 — ROADMAP.md)\n`);
  stderr.write(`ለማየት፦ ahadu tokens ${command}  ወይም  ahadu ast ${command}\n`);
  return 2;
}

exit(main(argv.slice(2)));
