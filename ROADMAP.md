# Roadmap

The specification is done; the implementation is not. Order matters here —
each milestone is independently verifiable, and none of them is allowed to
change the language without changing `spec/LANGUAGE.md` in the same change.

## M1 — Lexer ✅

`spec/LANGUAGE.md` §2–3, §9.3 · `src/lexer/`

Tokens with code-point columns, keyword variant folding, `የ` kept attached
(C23), `እስከሆነ ድረስ` as one token (C11), indentation normalization, Ethiopic
punctuation including `።`, Ge'ez numeral literals (§3.4.1), the `&` / `|` / `!`
aliases, and non-throwing error recovery.

**Done**: 356 tests, 100% statement and function coverage, 97% branch.
`tests/unit/lexer/spec-tables.test.ts` re-parses the keyword table out of the
spec and fails if the code drifts from it. `tests/unit/lexer/corpus.test.ts`
lexes all 38 conformance cases and all 7 examples, checking each case's
diagnostics against its own header. `ahadu tokens` prints the table.

Found while implementing: `ለ` was reserved for a future `for` loop, which
would have cost the most natural short variable name in Amharic. Now
`ለእያንዳንዱ` (§3.2). Also settled that invisible formatting is dropped in code
but **kept** inside string literals, which §2.1 had left ambiguous — a string
is data.

## M2 — Parser ✅

§5–7, `GRAMMAR.ebnf` · `src/parser/`

The critical piece is statement dispatch: parse an expression first, then look
for `ከሆነ` / `እስከሆነ ድረስ` behind it (C01). Also: assignment as a statement
(C12), non-associative comparison, `^` tighter than unary minus, a slice node
(C04), structured class bodies (C03), panic-mode recovery.

**Done**: 821 tests, 99.7% statement coverage, 100% function coverage. All 7
examples and all 46 conformance cases parse with exactly the diagnostics their
headers claim, `tests/unit/parser/corpus.test.ts` checks the §9.2 catalogue is
actually exercised, and `ahadu ast` / `ahadu check` print a tree and
diagnostics for each.

Found while implementing: `AH2009` and `AH2011` were filed as syntactic but
one of them cannot be known until runtime, so the catalogue was re-cut along
the line of *when a problem is detectable* — see §9.2 and the note under it.
§5.2 also asked the lexer to detect over-indentation relative to a block
opener, which only the parser can see; that is `AH2015` now.

## M3 — Interpreter

§4, §5.3, §6–9 · `src/interpreter/`

Values including `እውነታ` and `ምንም`, presence-based scope lookup (C19), a real
return signal (C17), immutable strings and mutable list references with
concatenating `+` and in-place `አዋህድ` / `ሰርዝ` (C15, C32), slices defaulting to
`n` (C16), dynamic method dispatch with constructor inheritance (C18), the
seven built-ins (C13, C28), and the full `AH3xxx` catalogue with tracebacks.

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
- Reserved words that have no syntax yet: `አዲስ`, `ለእያንዳንዱ` (for each),
  `አቁም` (break), `ቀጥል` (continue). Each needs a spec change before an
  implementation.
- Language-server protocol support, reusing the parser's error recovery.
