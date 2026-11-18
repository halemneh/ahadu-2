# Roadmap

The specification is done; the implementation is not. Order matters here —
each milestone is independently verifiable, and none of them is allowed to
change the language without changing `spec/LANGUAGE.md` in the same change.

## M1 — Lexer

`spec/LANGUAGE.md` §2–3, §9.3 · `src/lexer/`

Tokens with code-point columns, keyword variant folding, `የ` kept attached
(C23), `እስከሆነ ድረስ` as one token (C11), indentation normalization, Ethiopic
punctuation including `።`, and non-throwing error recovery.

**Done when**: unit tests cover every token kind and every `AH1xxx` code, and
`ahadu tokens` prints a sane table for all seven `examples/`.

## M2 — Parser

§5–7, `GRAMMAR.ebnf` · `src/parser/`

The critical piece is statement dispatch: parse an expression first, then look
for `ከሆነ` / `እስከሆነ ድረስ` behind it (C01). Also: assignment as a statement
(C12), non-associative comparison, `^` tighter than unary minus, a slice node
(C04), structured class bodies (C03), panic-mode recovery.

**Done when**: every `examples/` file and every `tests/conformance/cases/`
file parses with exactly the diagnostics its header claims, and `ahadu ast`
prints a tree for each.

## M3 — Interpreter

§4, §5.3, §6–9 · `src/interpreter/`

Values including `እውነታ` and `ምንም`, presence-based scope lookup (C19), a real
return signal (C17), immutable text and lists with concatenating `+` (C15),
slices defaulting to `n` (C16), dynamic method dispatch with constructor
inheritance (C18), the six built-ins (C13, C28), and the full `AH3xxx`
catalogue with tracebacks.

**Done when**: `npm run test:conformance` passes with the skip guard in
`tests/conformance/run.test.ts` removed, and `tests/helpers/run-source.ts` is
implemented rather than throwing.

## M4 — CLI

`spec/TOOLING.md` §1 · `src/cli/`

`run`, `tokens`, `ast`, `check`, `trace`, the REPL, `--json`, and the shared
diagnostic renderer. stdout for program output, stderr for diagnostics.

## M5 — Playground

`spec/TOOLING.md` §2 · `tools/playground/`

Editor with live Output / Tokens / AST panels, debounced re-lex and re-parse,
evaluation in a worker with a step budget, examples loaded from `examples/`.

## Afterwards

- `ahadu fmt` (TOOLING.md §1.6).
- Reserved words that have no syntax yet: `አዲስ`, `ለ` (for), `አቁም` (break),
  `ቀጥል` (continue). Each needs a spec change before an implementation.
- Language-server protocol support, reusing the parser's error recovery.
