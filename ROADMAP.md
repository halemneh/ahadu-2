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

## M3 — Interpreter ✅

§4, §5.3, §6–9 · `src/interpreter/`

Values including `እውነታ` and `ምንም`, presence-based scope lookup (C19), a real
return signal (C17), immutable strings and mutable list references with
concatenating `+` and in-place `አዋህድ` / `ሰርዝ` (C15, C32), slices defaulting to
`n` (C16), dynamic method dispatch with constructor inheritance (C18), the
seven built-ins (C13, C28), and the full `AH3xxx` catalogue with tracebacks.

**Done**: 1,174 tests. The conformance suite runs for real — all 54 cases and
all 7 examples — and every error code in the §9.2 catalogue now has a case,
at all three stages.

Found while implementing:

- `AH3016` (redeclaration) could not survive §5.3. Blocks create no scope, so
  a typed declaration inside a loop runs again every iteration, and a rule
  that fires on the second *execution* of one declaration is not the rule
  anyone wanted. Retired; re-typing surfaces as `AH3009` against the first
  annotation, which says more.
- `:-` inside brackets was ambiguous with a negative slice end, so `ዝ[:-1]`
  could not be written. Inside brackets `:` is now always the slice
  separator — a block cannot open there anyway (§3.5).
- The call-depth guard was set above what the host stack allows, so runaway
  recursion crashed instead of reporting. Default lowered to 200, and `run`
  now catches a genuine stack overflow as `AH3017` too: the host's stack size
  is not knowable from here.
- `AH3017` and `AH3018` are new — resource limits, so that runaway recursion
  and endless loops end in an Ahadu error rather than taking the host down.

## M4 — CLI and REPL ✅

`spec/TOOLING.md` §1 · `src/cli/`

`run`, `tokens`, `ast`, `check`, `trace`, the REPL, `--json`, `--no-color`,
and the shared diagnostic renderer with tracebacks. stdout carries program
output and stderr the diagnostics.

**Done**: 1,237 tests. The REPL takes its I/O as an argument, so a session is
an ordinary function call in a test rather than a spawned process with timing
to get wrong; `commands.test.ts` still drives the real binary end to end.

Found while implementing:

- `readLineSync` decoded standard input **one byte at a time**, so every
  three-byte Ethiopic character became three replacement characters. It had
  been there since M3 and only affected `አንብብ`, which no example used — the
  REPL made it the first thing you see. There is an `አንብብ` example now, and a
  test that asserts no U+FFFD comes back.
- The REPL re-checked whether an entry looked complete after every line, so
  `ዕድሜ > 18 ከሆነ፦` / `ጻፍ("ትልቅ")` ran as soon as the body's first line parsed,
  orphaning the `አለበለዚያ` that followed. An open block now runs on a blank
  line, as §1.2 says, while an unclosed bracket still runs the moment it
  closes — the two are told apart.
- `--ascii` is gone from the spec. It was meant to help terminals with poor
  Ethiopic font coverage, but every message Ahadu prints is Amharic, so
  transliterating four punctuation marks achieves nothing the flag claimed.
  What such a terminal actually costs you is caret alignment, which nothing
  in the CLI can fix; TOOLING.md §1 now says so.

## M5 — Playground ✅

`spec/TOOLING.md` §2 · `tools/playground/`

Editor with live ውጤት / ቶከኖች / ዛፍ / ስተቶች panels, debounced re-lex and re-parse,
evaluation in a worker with a step budget, examples loaded from `examples/`.

**Done**: 1,308 tests. The editor is a transparent `<textarea>` over a `<pre>`
coloured from the lexer's own token spans — so a keyword variant the lexer
accepts cannot fail to light up, and `ከሆነነገር` cannot pretend to be a keyword.
The whole page is 44 kB of JavaScript with no dependencies.

Found while implementing:

- `አንብብ` could not work the way §2.2 specified. It is synchronous, so that
  the interpreter can be, and the program runs in a worker — a modal prompt on
  the main thread could only answer it through `SharedArrayBuffer` and
  `Atomics.wait`, which needs cross-origin isolation headers and so would stop
  the page being static. There is an input panel instead, which is also the
  better teaching tool: the input is visible and a program can be re-run
  against it unchanged.
- Everything that decides what appears lives in `view.ts` and `highlight.ts`,
  with no DOM access, because this project has no browser in its test run.
  `main.ts` is glue. That split is the only reason the page is tested at all —
  the same move that made the REPL testable in M4.

## Afterwards

- `ahadu fmt` (TOOLING.md §1.6).
- Reserved words that have no syntax yet: `አዲስ`, `ለእያንዳንዱ` (for each),
  `አቁም` (break), `ቀጥል` (continue). Each needs a spec change before an
  implementation.
- Language-server protocol support, reusing the parser's error recovery.
