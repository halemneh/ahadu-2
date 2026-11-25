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
  the page being static. The resolution came later: the page cannot ask
  *during* a run, but it can ask *before* one, because the call to `አንብብ` is
  in the tokens it has already lexed. A dialog opens ahead of the run for the
  programs that need it, and no input box clutters the page for the ones that
  do not.
- Everything that decides what appears lives in `view.ts` and `highlight.ts`,
  with no DOM access, because this project has no browser in its test run.
  `main.ts` is glue. That split is the only reason the page is tested at all —
  the same move that made the REPL testable in M4.

## M6 — the website ✅

`ahaducode.com`: home, a seven-lesson track, a generated reference and the
examples gallery, in Amharic and English, with the playground at
`/playground`. Specified in `spec/SITE.md`, built by `tools/site/`.

The commitment that shaped it: **every Ahadu snippet on the site is executed
by the real interpreter at build time, and a snippet whose output is not what
the page claims fails the build.** A teaching site full of code nobody ran is
the C01 failure aimed at beginners, who cannot tell a typo in a lesson from a
mistake of their own. 112 snippets are checked on every build.

Found while implementing:

- Writing the lessons against that check corrected the lessons four times: a
  guessed error code (`AH3002`, not `AH3006`), an unclosed bracket's code
  (`AH2002`, not `AH2001`), `ቁጥር` used as a variable name when it is the
  reserved type name, and strings printing *with* quotes inside a collection
  but without them alone. Each was a wrong thing I was about to teach.
- Two of those became lessons in their own right, which is the argument for
  the mechanism: the build does not just stop mistakes, it finds the things
  worth explaining.
- The reference is generated from `KEYWORDS` and `MESSAGES`, and a keyword
  type with no gloss fails the build — otherwise a new keyword would appear
  to a beginner as `func` or `init`.
- Pages are paired across languages by an `id` in their front matter, not by
  filename, because the filenames are in different scripts. A page present in
  one language and missing in the other is a build failure.
- Design tokens moved to `tools/shared/tokens.css`, imported by both the site
  and the playground, so the two cannot drift into looking like different
  projects.

## M7 — enough language to write a program ✅

M6 shipped a site that taught a language in which a calculator could not be
written: `አንብብ` returns `ጽሁፍ`, `+` refuses to mix a `ጽሁፍ` with a `ቁጥር`, and
nothing converted between them. M7 is what closed that.

- **Conversion and chance** — `ወደቁጥር`, `ወደጽሁፍ`, `ቁጥርነው`, `አጋጣሚ`, `ዘር`.
  Randomness is seeded and its default seed is fixed, so the site can keep
  running every snippet at build time (LANGUAGE.md §8.4).
- **`ለእያንዳንዱ`** (§7.4), which left the reserved list below. The iteration is
  a snapshot of the collection, so `አዋህድ` in the body cannot loop forever and
  `ሰርዝ` cannot skip an element.
- **A standard library**, written in Ahadu and run as its own program before
  the learner's, so their line numbers and step budget stay their own
  (§8.5–8.6).
- **Whole numbers, text splitting, Ge'ez numerals out and the Ethiopian
  calendar** (§8.7–8.8).
- **`AH3013` names a shadowed built-in** (§8.2), which is what makes a
  pre-bound global named with a noun survivable.
- Four lessons for all of it, and the site's visual refresh: the syntax
  colours the pages had never actually been given, a phone drawer, and an
  accessibility audit that runs in a browser (`npm run site:audit`).

## Afterwards

- `ahadu fmt` (TOOLING.md §1.6).
- Reserved words that have no syntax yet: `አዲስ`, `አቁም` (break), `ቀጥል`
  (continue), `ፊደል` (char). Each needs a spec change before an
  implementation.
- A way for a program to raise an error of its own. §8.5 records why this
  matters: without it, a library function written in Ahadu can only fail
  wherever its own arithmetic happens to break, which bounds how much of a
  standard library can honestly be written in the language.
- Drawing and a host-driven frame loop, so a program can make something to
  look at and something to play.
- Language-server protocol support, reusing the parser's error recovery.
