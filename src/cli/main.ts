#!/usr/bin/env node
/**
 * The `ahadu` command (TOOLING.md §1).
 *
 * Program output goes to stdout and diagnostics to stderr, so redirecting
 * stdout captures exactly what a program printed (§1.4).
 *
 * A runner stops at the first stage that reports: lexing problems make the
 * token stream untrustworthy, so parsing it would pile guesses on a known
 * error (LANGUAGE.md §9.3). An editor asks each stage directly instead.
 */

import { readFileSync, readSync } from 'node:fs';
import process, { argv, exit, stderr, stdin, stdout } from 'node:process';
import type { Diagnostic } from '../diagnostics.js';
import { AH9001, MESSAGES, internalCause } from '../diagnostics.js';
import { tokenize } from '../lexer/index.js';
import type { Token } from '../lexer/index.js';
import { parse, printAst } from '../parser/index.js';
import { render } from '../interpreter/index.js';
// The library-loading `run`, not the bare one: a program typed at the
// terminal gets the same globals as one in the playground (§8.5).
import { run } from '../engine.js';
import type { Host, RunOptions } from '../interpreter/index.js';
import { colorEnabled, palette } from './color.js';
import type { Palette } from './color.js';
import { renderDiagnostic } from './report.js';
import { runRepl } from './repl.js';

const USAGE = `አሃዱ — Ahadu 2.0

  ahadu <file>           run a program
  ahadu                  start the REPL
  ahadu tokens <file>    the lexer's output as a table
  ahadu ast <file>       the parse tree
  ahadu check <file>     report diagnostics, exit 1 if there are any
  ahadu trace <file>     run, printing each statement and its value

  --json                 machine-readable output
  --no-color             no colour, as NO_COLOR also does
  --seed=<n>             fix what ዘፈቀደ_ቁጥር draws, so a run repeats exactly
  --help                 this message

See spec/TOOLING.md for the full design, ROADMAP.md for what lands when.
`;

/** Indent levels shown before the trace stops widening, so deep recursion stays readable. */
const TRACE_INDENT_CAP = 8;

interface Flags {
  readonly json: boolean;
  readonly colors: Palette;
  readonly errorColors: Palette;
  /**
   * The seed `ዘፈቀደ_ቁጥር` starts from.
   *
   * A changing one unless `--seed=<n>` was given: running a program twice at
   * a terminal should roll different dice. The interpreter's own default is
   * fixed instead, because its other callers — the conformance suite, the
   * site's snippet checker — want the opposite (LANGUAGE.md §8).
   */
  readonly seed: number;
  /** The instant `ዛሬ` reports. The real clock here; fixed in the interpreter. */
  readonly now: number;
}

/**
 * Diagnostics as `--json` emits them (TOOLING.md §1.3): every field of the
 * diagnostic plus `severity`, which the spec lists and the objects lacked.
 * Everything Ahadu reports is an error; there are no warnings in 2.0.
 */
function asJson(diagnostics: readonly Diagnostic[]): object[] {
  return diagnostics.map((d) => ({ ...d, severity: 'error' }));
}

function reportDiagnostics(source: string, diagnostics: readonly Diagnostic[], flags: Flags): void {
  // With --json, a lexer or parser error that stops a command is JSON too.
  // It used to be the human rendering whatever the flag said, so an editor
  // asking for JSON got prose exactly when there was something to report.
  if (flags.json) {
    stderr.write(`${JSON.stringify({ diagnostics: asJson(diagnostics) }, null, 2)}\n`);
    return;
  }
  for (const d of diagnostics) {
    stderr.write(renderDiagnostic(source, d, flags.errorColors));
    debugCause(d);
  }
}

/** With `AHADU_DEBUG=1`, what an AH9001 is hiding — for whoever fixes it. */
function debugCause(d: Diagnostic): void {
  if (d.code !== AH9001 || process.env.AHADU_DEBUG !== '1') return;
  const cause = internalCause(d);
  stderr.write(`${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}\n`);
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

function tokenRow(t: Token): string {
  const span = `${t.line}:${t.startCol}-${t.endCol}`.padEnd(12);
  const type = t.type.padEnd(11);
  const value = t.value === null ? '' : String(t.value);
  const of = t.hasOfPrefix === true ? `  (የ + ${String(t.stem)})` : '';
  return `  ${span}${type}${value}${of}`;
}

// ---------------------------------------------------------------------------
// Stage subcommands
// ---------------------------------------------------------------------------

function cmdTokens(source: string, flags: Flags): number {
  const { tokens, diagnostics } = tokenize(source);

  if (flags.json) {
    stdout.write(`${JSON.stringify({ tokens, diagnostics: asJson(diagnostics) }, null, 2)}\n`);
  } else {
    for (const t of tokens) stdout.write(`${tokenRow(t)}\n`);
    stdout.write(`\n  ${tokens.length} ቶከኖች`);
    stdout.write(diagnostics.length > 0 ? `, ${diagnostics.length} ስተቶች\n` : '\n');
    reportDiagnostics(source, diagnostics, flags);
  }

  return diagnostics.length > 0 ? 1 : 0;
}

function cmdAst(source: string, flags: Flags): number {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    reportDiagnostics(source, lexed.diagnostics, flags);
    return 1;
  }

  const { program, diagnostics } = parse(lexed.tokens);

  if (flags.json) {
    stdout.write(`${JSON.stringify({ program, diagnostics: asJson(diagnostics) }, null, 2)}\n`);
  } else {
    stdout.write(`${printAst(program)}\n`);
    reportDiagnostics(source, diagnostics, flags);
  }

  return diagnostics.length > 0 ? 1 : 0;
}

function cmdCheck(source: string, flags: Flags): number {
  const lexed = tokenize(source);
  const diagnostics =
    lexed.diagnostics.length > 0 ? lexed.diagnostics : parse(lexed.tokens).diagnostics;

  if (flags.json) {
    stdout.write(`${JSON.stringify({ diagnostics: asJson(diagnostics) }, null, 2)}\n`);
  } else if (diagnostics.length === 0) {
    stdout.write('ምንም ስተት አልተገኘም።\n');
  } else {
    reportDiagnostics(source, diagnostics, flags);
    stderr.write(`${diagnostics.length} ስተት${diagnostics.length > 1 ? 'ች' : ''}\n`);
  }

  return diagnostics.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

/**
 * Reads one line from standard input, synchronously.
 *
 * Byte at a time rather than a buffered read, so an interactive terminal
 * returns as soon as the user presses enter instead of waiting for EOF. This
 * is also what lets the REPL and `አንብብ` share one input path.
 *
 * The bytes are collected and decoded **once, per line**. Decoding each byte
 * on its own would turn every Ethiopic character — three bytes of UTF-8 —
 * into three replacement characters, which is to say it would make the REPL
 * unusable for the language it is a REPL for.
 */
function readLineSync(): string | null {
  const byte = Buffer.alloc(1);
  const bytes: number[] = [];

  const line = (): string => Buffer.from(bytes).toString('utf8').replace(/\r$/, '');

  for (;;) {
    let read = 0;
    try {
      read = readSync(0, byte, 0, 1, null);
    } catch {
      break;
    }
    if (read === 0) break;

    const value = byte[0] as number;
    if (value === 0x0a) return line();
    bytes.push(value);
  }

  return bytes.length === 0 ? null : line();
}

function cliHost(): Host {
  return {
    write: (text: string): void => {
      stdout.write(text);
    },
    readLine: (prompt: string | null): string => {
      if (prompt !== null) stdout.write(prompt);
      return readLineSync() ?? '';
    },
  };
}

function execute(source: string, flags: Flags, options: RunOptions = {}): number {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    reportDiagnostics(source, lexed.diagnostics, flags);
    return 1;
  }

  const parsed = parse(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    reportDiagnostics(source, parsed.diagnostics, flags);
    return 1;
  }

  const result = run(parsed.program, cliHost(), { seed: flags.seed, now: flags.now, ...options });

  if (result.diagnostic !== null) {
    if (flags.json) {
      stderr.write(`${JSON.stringify({ diagnostics: asJson([result.diagnostic]) }, null, 2)}\n`);
    } else {
      stderr.write(renderDiagnostic(source, result.diagnostic, flags.errorColors, result.frames));
      debugCause(result.diagnostic);
    }
    return 1;
  }

  return 0;
}

function cmdRun(source: string, flags: Flags): number {
  return execute(source, flags);
}

function cmdTrace(source: string, flags: Flags): number {
  const lines = source.split(/\r\n|\r|\n/);
  return execute(source, flags, {
    onStatement: (line, value, depth) => {
      const text = (lines[line - 1] ?? '').trim();
      const shown = value.kind === 'nothing' ? '' : ` → ${render(value)}`;
      const indent = '  '.repeat(Math.min(depth, TRACE_INDENT_CAP));
      const deeper = depth > TRACE_INDENT_CAP ? `+${depth - TRACE_INDENT_CAP} ` : '';
      stderr.write(
        `  ${indent}${deeper}${flags.errorColors.dim(`${line}:`)} ${text}${flags.errorColors.dim(shown)}\n`,
      );
    },
  });
}

function cmdRepl(flags: Flags): number {
  // Raw mode is deliberately not used: the REPL reads whole lines, so the
  // terminal's own editing and history are better than anything reimplemented
  // here would be.
  if (stdin.isTTY === true) stdin.resume();

  return runRepl(
    {
      write: (text) => {
        stdout.write(text);
      },
      writeError: (text) => {
        stderr.write(text);
      },
      readLine: (prompt) => {
        stdout.write(prompt);
        return readLineSync();
      },
    },
    // The seed and the clock too, not just the palette: without them an
    // ordinary `ahadu` session repeats one random sequence and reports the
    // Unix epoch for `ዛሬ()`, while running the same program from a file does
    // the right thing.
    { colors: flags.colors, seed: flags.seed, now: flags.now },
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Reads `--seed=<n>`, falling back to the clock.
 *
 * A malformed value falls back too rather than failing: `--seed=abc` asks for
 * a repeatable run and gets a run, which is a smaller surprise than an exit
 * code from a flag that only affects dice.
 */
function readSeed(args: readonly string[]): number {
  const flag = args.find((a) => a.startsWith('--seed='));
  if (flag === undefined) return Date.now();
  const value = Number(flag.slice('--seed='.length));
  return Number.isFinite(value) ? value : Date.now();
}

function main(args: string[]): number {
  const json = args.includes('--json');
  const wantsColor = !args.includes('--no-color');
  const operands = args.filter((a) => !a.startsWith('--'));

  const flags: Flags = {
    json,
    colors: palette(colorEnabled(stdout, wantsColor)),
    errorColors: palette(colorEnabled(stderr, wantsColor)),
    seed: readSeed(args),
    now: Date.now(),
  };

  if (args.includes('--help') || (operands.length === 0 && args.length > 0 && !json)) {
    stdout.write(USAGE);
    return 0;
  }

  const [command, ...rest] = operands;

  const stages: Record<string, ((source: string, flags: Flags) => number) | undefined> = {
    tokens: cmdTokens,
    ast: cmdAst,
    check: cmdCheck,
    run: cmdRun,
    trace: cmdTrace,
  };

  const stage = command === undefined ? undefined : stages[command];
  if (stage !== undefined) {
    const path = rest[0];
    if (path === undefined) {
      stderr.write(`የፋይል ስም ያስፈልጋል፦ ahadu ${String(command)} <file>\n`);
      return 2;
    }
    const source = read(path);
    if (source === null) return 2;
    return stage(source, flags);
  }

  // No command at all starts the REPL.
  if (command === undefined) return cmdRepl(flags);

  // A bare path means "run this file".
  const source = read(command);
  if (source === null) return 2;
  return cmdRun(source, flags);
}

/*
 * The last line of defence. Every stage already returns AH9001 for its own
 * failures; this catches anything in the CLI itself, so a reader never sees
 * a JavaScript stack trace — only an Amharic message asking them to report
 * it. `AHADU_DEBUG=1` shows what it hid.
 */
try {
  exit(main(argv.slice(2)));
} catch (thrown) {
  stderr.write(`[${AH9001}] ${MESSAGES[AH9001] ?? ''}\n`);
  if (process.env.AHADU_DEBUG === '1') {
    stderr.write(
      `${thrown instanceof Error ? (thrown.stack ?? thrown.message) : String(thrown)}\n`,
    );
  }
  exit(70);
}
