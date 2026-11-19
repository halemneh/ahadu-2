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

import { readFileSync, readSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';
import { formatDiagnostic } from '../diagnostics.js';
import type { Diagnostic } from '../diagnostics.js';
import { tokenize } from '../lexer/index.js';
import type { Token } from '../lexer/index.js';
import { parse, printAst } from '../parser/index.js';
import { render, run } from '../interpreter/index.js';
import type { Frame, Host, RunOptions } from '../interpreter/index.js';

const USAGE = `አሃዱ — Ahadu ${'2.0'}

  ahadu <file>           run a program
  ahadu tokens <file>    the lexer's output as a table
  ahadu ast <file>       the parse tree
  ahadu check <file>     report diagnostics, exit 1 if there are any
  ahadu trace <file>     run, printing each statement and its value
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

/**
 * Renders the call traceback that follows a runtime error (§9.1), outermost
 * frame first, with the global one named ዋና ፕሮግራም.
 */
function traceback(frames: readonly Frame[]): string {
  if (frames.length <= 1) return '';
  const rule = '-'.repeat(60);
  const lines = frames.map((f, i) =>
    i === 0 ? ` መስመር ${f.line} ላይ ${f.name}` : `${'  '.repeat(i)}↓ መስመር ${f.line} ላይ ${f.name}`,
  );
  return ` የጥሪ መልሶ ምልከታ ፦\n${rule}\n${lines.join('\n')}\n${rule}\n`;
}

/**
 * Reads one line from standard input, synchronously, for `አንብብ`.
 *
 * Byte at a time rather than a buffered read, so an interactive terminal
 * returns as soon as the user presses enter instead of waiting for EOF.
 */
function readLineSync(): string {
  const byte = Buffer.alloc(1);
  let text = '';
  for (;;) {
    let read = 0;
    try {
      read = readSync(0, byte, 0, 1, null);
    } catch {
      return text;
    }
    if (read === 0) return text;
    const char = byte.toString('utf8');
    if (char === '\n') return text.replace(/\r$/, '');
    text += char;
  }
}

function cliHost(): Host {
  return {
    write: (text) => {
      stdout.write(text);
    },
    readLine: (prompt) => {
      if (prompt !== null) stdout.write(prompt);
      return readLineSync();
    },
  };
}

/** Lexes, parses, and runs, stopping at the first stage that reports (§9.3). */
function execute(source: string, json: boolean, options: RunOptions = {}): number {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    reportDiagnostics(source, lexed.diagnostics);
    return 1;
  }

  const parsed = parse(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    reportDiagnostics(source, parsed.diagnostics);
    return 1;
  }

  const result = run(parsed.program, cliHost(), options);

  if (result.diagnostic !== null) {
    if (json) {
      stderr.write(`${JSON.stringify({ diagnostics: [result.diagnostic] }, null, 2)}\n`);
    } else {
      reportDiagnostics(source, [result.diagnostic]);
      const stack = traceback(result.frames);
      if (stack !== '') stderr.write(`${stack}\n`);
    }
    return 1;
  }

  return 0;
}

function cmdRun(source: string, json: boolean): number {
  return execute(source, json);
}

/** Indent levels shown before the trace stops widening, so deep recursion stays readable. */
const TRACE_INDENT_CAP = 8;

function cmdTrace(source: string, json: boolean): number {
  const lines = source.split(/\r\n|\r|\n/);
  return execute(source, json, {
    onStatement: (line, value, depth) => {
      const text = (lines[line - 1] ?? '').trim();
      const shown = value.kind === 'nothing' ? '' : ` → ${render(value)}`;
      const indent = '  '.repeat(Math.min(depth, TRACE_INDENT_CAP));
      const deeper = depth > TRACE_INDENT_CAP ? `+${depth - TRACE_INDENT_CAP} ` : '';
      stderr.write(`  ${indent}${deeper}${line}: ${text}${shown}\n`);
    },
  });
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
    run: cmdRun,
    trace: cmdTrace,
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

  // A bare path means "run this file".
  const source = read(command);
  if (source === null) return 2;
  return cmdRun(source, json);
}

exit(main(argv.slice(2)));
