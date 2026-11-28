/**
 * Whether a typed entry is finished (TOOLING.md §1.2, §2.2).
 *
 * Shared by the CLI's REPL and the playground's console, which both take a
 * program a line at a time and have to decide when to run it. Kept here
 * rather than in `src/cli` because the playground runs in a browser and the
 * CLI's modules may use Node.
 */

import { tokenize } from './lexer/index.js';

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
