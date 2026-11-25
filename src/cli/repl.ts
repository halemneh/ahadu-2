/**
 * The REPL (TOOLING.md §1.2).
 *
 * I/O is injected rather than reached for, so a session can be driven by a
 * script in a test as easily as by a terminal — which is the only way to test
 * a REPL without spawning a process and timing the output.
 */

import { tokenize } from '../lexer/index.js';
import { parse, printAst } from '../parser/index.js';
import { render } from '../interpreter/index.js';
import type { Interpreter } from '../interpreter/index.js';
// One long-lived interpreter across entries, with the library loaded once.
import { withLibrary } from '../engine.js';
import type { Host, RunOptions } from '../interpreter/index.js';
import { describeToken } from '../lexer/index.js';
import type { Palette } from './color.js';
import { palette } from './color.js';
import { renderDiagnostic } from './report.js';

export interface ReplIo {
  /** Program output, values, and notices. */
  write: (text: string) => void;
  /** Diagnostics. */
  writeError: (text: string) => void;
  /** Reads one line without its break, or null at end of input. */
  readLine: (prompt: string) => string | null;
}

export interface ReplOptions extends RunOptions {
  readonly colors?: Palette;
}

const PROMPT = 'አሃዱ> ';
const CONTINUATION = '   ... ';

const HELP = `  :help            ይህ መልእክት
  :tokens <ኮድ>     የቶከኖች ሰንጠረዝ
  :ast <ኮድ>        የአገባብ ዛፍ
  :clear           ሁሉንም ተለዋጮች አጥፋ
  :quit            ውጣ   (ወይም Ctrl-D)

ብሎክ ለመጻፍ መስመሩን በ"፦" ጨርሱ፤ ባዶ መስመር ሲመጣ ይሰራል።
`;

/**
 * How an entry can be unfinished.
 *
 * The two reasons end differently, which is why they are told apart. An
 * unclosed bracket is finished the moment it closes, so `ጻፍ(` + `1)` runs
 * straight away. An open block has no such mark — the body is however many
 * indented lines the writer wants — so it runs on a blank line instead
 * (TOOLING.md §1.2).
 *
 * Both are structural, so neither needs the parser's opinion, which matters
 * because a half-typed entry is full of parse errors by definition.
 */
export function inspectEntry(source: string): { openBracket: boolean; opensBlock: boolean } {
  const { tokens } = tokenize(source);
  let depth = 0;
  let last = '';

  for (const token of tokens) {
    if (token.type === 'LPAREN' || token.type === 'LBRACKET') depth += 1;
    if (token.type === 'RPAREN' || token.type === 'RBRACKET') depth -= 1;
    if (token.type !== 'EOF' && token.type !== 'NEWLINE' && token.type !== 'INDENT') {
      last = token.type;
    }
  }

  return { openBracket: depth > 0, opensBlock: last === 'THEN' };
}

/** Runs one entry: lex, parse, evaluate, print. Stops at the first stage that reports. */
function evaluateEntry(
  source: string,
  interpreter: Interpreter,
  io: ReplIo,
  colors: Palette,
): void {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    for (const d of lexed.diagnostics) io.writeError(renderDiagnostic(source, d, colors));
    return;
  }

  const parsed = parse(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    for (const d of parsed.diagnostics) io.writeError(renderDiagnostic(source, d, colors));
    return;
  }

  const result = interpreter.tryRun(parsed.program);
  if (result.diagnostic !== null) {
    io.writeError(renderDiagnostic(source, result.diagnostic, colors, result.frames));
    return;
  }

  // An expression prints its value; a statement that evaluates to ምንም prints
  // nothing, so assignments and declarations stay quiet (TOOLING.md §1.2).
  if (result.value.kind !== 'nothing') io.write(`${render(result.value)}\n`);
}

/** Handles a `:` meta-command. Returns false when the session should end. */
function meta(line: string, io: ReplIo, colors: Palette, reset: () => void): boolean {
  const [command = '', ...rest] = line.slice(1).trim().split(/\s+/);
  const argument = line.slice(1).trim().slice(command.length).trim();
  void rest;

  switch (command) {
    case 'help':
    case 'h':
      io.write(HELP);
      return true;

    case 'quit':
    case 'q':
      return false;

    case 'clear':
      reset();
      io.write('ተለዋጮች ጠፍተዋል።\n');
      return true;

    case 'tokens': {
      if (argument === '') {
        io.writeError('ኮድ ያስፈልጋል፦ :tokens <ኮድ>\n');
        return true;
      }
      const { tokens, diagnostics } = tokenize(argument);
      for (const token of tokens) io.write(`  ${describeToken(token)}\n`);
      for (const d of diagnostics) io.writeError(renderDiagnostic(argument, d, colors));
      return true;
    }

    case 'ast': {
      if (argument === '') {
        io.writeError('ኮድ ያስፈልጋል፦ :ast <ኮድ>\n');
        return true;
      }
      const lexed = tokenize(argument);
      if (lexed.diagnostics.length > 0) {
        for (const d of lexed.diagnostics) io.writeError(renderDiagnostic(argument, d, colors));
        return true;
      }
      const { program, diagnostics } = parse(lexed.tokens);
      io.write(`${printAst(program)}\n`);
      for (const d of diagnostics) io.writeError(renderDiagnostic(argument, d, colors));
      return true;
    }

    default:
      io.writeError(`ያልታወቀ ትእዛዝ፦ :${command}  (:help ይሞክሩ)\n`);
      return true;
  }
}

/**
 * Runs a REPL session until `:quit` or end of input.
 *
 * Bindings persist across entries because one interpreter serves the whole
 * session; `:clear` is what replaces it.
 */
export function runRepl(io: ReplIo, options: ReplOptions = {}): number {
  const colors = options.colors ?? palette(false);

  const host: Host = {
    write: (text) => {
      io.write(text);
    },
    readLine: (prompt) => io.readLine(prompt ?? '') ?? '',
  };

  let interpreter = withLibrary(host, options);
  const buffer: string[] = [];
  /** Set once a line has opened a block: the entry then runs on a blank line. */
  let inBlock = false;

  const finish = (): void => {
    evaluateEntry(buffer.join('\n'), interpreter, io, colors);
    buffer.length = 0;
    inBlock = false;
  };

  io.write(`አሃዱ 2.0 — :help ለእርዳታ\n`);

  for (;;) {
    const line = io.readLine(
      buffer.length === 0 ? colors.prompt(PROMPT) : colors.dim(CONTINUATION),
    );

    // End of input, as Ctrl-D sends.
    if (line === null) {
      if (buffer.length > 0) finish();
      io.write('\n');
      return 0;
    }

    // A blank line ends a block (TOOLING.md §1.2), and is otherwise ignored.
    if (line.trim() === '') {
      if (buffer.length > 0) finish();
      continue;
    }

    // Meta-commands are only commands at the start of an entry, so a `:` in
    // the middle of a block is ordinary Ahadu — a slice separator, say.
    if (buffer.length === 0 && line.startsWith(':')) {
      if (
        !meta(line, io, colors, () => {
          interpreter = withLibrary(host, options);
        })
      ) {
        return 0;
      }
      continue;
    }

    buffer.push(line);
    const { openBracket, opensBlock } = inspectEntry(buffer.join('\n'));

    if (openBracket) continue;
    if (opensBlock) inBlock = true;
    if (inBlock) continue;

    finish();
  }
}
