# Tooling Specification

The interpreter is a teaching artifact, so every stage of it has to be
inspectable without reading the source. Two front ends cover that: a CLI for
development, and a browser playground for learners.

## 1. CLI — `ahadu`

```
ahadu <file.ahadu>            run a program
ahadu                         start the REPL
ahadu tokens <file>           lexer output only
ahadu ast <file>              parser output only
ahadu check <file>            lex + parse, report diagnostics, exit 1 if any
ahadu trace <file>            run, printing each statement and its value
ahadu fmt <file>              canonical formatting (later; see §1.6)
```

Global flags: `--json` (machine-readable output for any subcommand),
`--no-color`, `--help`, `--seed=<n>`.

`--seed=<n>` fixes what `ዘፈቀደ_ቁጥር` draws, so a run repeats exactly — for a bug
report, or for a test. Without it the CLI seeds from the clock: running a
program twice at a terminal should roll different dice. The interpreter's own
default is a **fixed** seed instead, because its other callers want the
opposite (LANGUAGE.md §8.4): the conformance suite and the site's snippet
checker both compare output against what a page claims, and a clock-seeded
default would put a hole in that check exactly where `ዘፈቀደ_ቁጥር` appears. A
malformed value falls back to the clock rather than failing, since the flag
only affects dice.

Colour is used sparingly — the code and caret of a diagnostic, the REPL's
prompt — and is off unless the stream is a terminal. `--no-color` forces it
off, as does a `NO_COLOR` environment variable of any value, per the de facto
convention.

There was an `--ascii` flag here, meant to render `፦` as `:-` for terminals
with poor Ethiopic font coverage. It is gone: every message Ahadu prints is
Amharic, so a terminal that cannot draw Ge'ez cannot show them whatever the
punctuation looks like, and transliterating four marks while leaving the words
alone achieves nothing the flag claimed.

The real cost of such a terminal is the caret line: Ethiopic syllables are
often drawn wide or variable-width, so the `^` under a span can sit beside the
span rather than beneath it. Nothing in the CLI can fix that — the line and
column in the message are the reliable part, which is one more reason they are
always printed.

### 1.1 Stage output is the debugging story

The pipeline is four stages, and each one has a subcommand that stops there:

```
source → tokens → AST → evaluation
         tokens   ast    run / trace
```

`ahadu tokens ሰላም.ahadu`:

```
  1:1-1:3   IDENTIFIER   ጻፍ
  1:4-1:4   LPAREN
  1:5-1:15  STRING       "ሰላም ዓለም"
  1:16-1:16 RPAREN
  1:17-1:17 NEWLINE
  2:1-2:1   EOF
```

`ahadu ast ሰላም.ahadu` prints an indented tree with positions:

```
Program [1:1-1:16]
└─ ExpressionStatement [1:1-1:16]
   └─ CallExpression [1:1-1:16]
      ├─ callee: Identifier ጻፍ [1:1-1:3]
      └─ args:
         └─ StringLiteral "ሰላም ዓለም" [1:5-1:15]
```

`ahadu trace` prints one line per statement executed — the source line, then
the value it produced — which is how a learner sees a loop actually looping.

### 1.2 REPL

- Prompt `አሃዱ>`; continuation prompt `   ...` while a block is open.
- A line ending in `፦` opens a block; the REPL keeps reading until a blank
  line, then evaluates the whole block.
- An expression statement prints its value. A statement that evaluates to
  `ምንም` prints nothing.
- Bindings persist across entries in one global scope.
- `:ትእዛዝ` meta-commands, all ASCII-prefixed so they can never collide with
  Ahadu syntax: `:tokens <expr>`, `:ast <expr>`, `:help`, `:clear`, `:quit`.
- Errors print the standard diagnostic (LANGUAGE.md §9.1) and leave the session
  alive.

### 1.3 Diagnostics

One renderer, shared by the CLI, the REPL, and the playground: the code in
brackets, the Amharic message, line and column, the source line, and a caret
span under the offending columns (LANGUAGE.md §9.1). The code is always shown,
never only in `--json`, so a learner can quote an error precisely when asking
for help. `--json` emits
`{code, message, line, startCol, endCol, stage, severity}` so an editor can
consume it.

Exit codes: `0` success · `1` diagnostics reported · `2` could not read input.

### 1.4 Program output

`ጻፍ` writes to stdout. Diagnostics go to stderr. A program's output must never
be interleaved with diagnostics on the same stream, so `ahadu run x.ahadu > out`
captures exactly what the program printed.

### 1.5 Performance budget

On a 1,000-line program: lexing under 50 ms, parsing under 100 ms. The budget
exists so that the playground can re-lex and re-parse on every keystroke.

These figures are for uninstrumented code on a developer machine, and that is
**not** what the test suite enforces. Under v8 coverage on a shared CI runner
the same work costs several times as much, so a test pinned to these numbers
measures the runner's weather rather than the code: one did, passing for weeks
at the edge and then failing at 63 ms. The suite enforces a ceiling an order of
magnitude higher, which still catches what such a test is worth having — an
accidental quadratic, which would cost seconds — without flaking.

### 1.6 `ahadu fmt`

Deferred past 2.0.0, but the shape is fixed now so the formatter does not have
to renegotiate the spec later: 4-space indentation, `፦` as the block marker,
`፣` as the list separator, one space around binary operators, no space inside
brackets.

## 2. Playground

`npm run play` serves a single page on `localhost:5173`.

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ አሃዱ   መነሻ ተማር ማጣቀሻ ምሳሌዎች ሜዳ          En ◐           │
├─────────────────────────────────────────────────────────┤
│ examples ▾                   0 errors        ▸ አሂድ      │
├─────────────────────────────────────────────────────────┤
│  1 │                                                    │
│  2 │  editor                                            │
│  3 │                                                    │
│  4 │                                                    │
│    │                                    መስመር 3፣ ዓምድ 12  │
├─────────────────────────────────────────────────────────┤
│  ውጤት │ ቶከኖች │ ዛፍ │ ስተቶች ③                               │
│                                                         │
│   active panel                                          │
├─────────────────────────────────────────────────────────┤
│ አሃዱ ነጻ እና ክፍት ምንጭ ነው።      ችግር አሳውቁ  ግላዊነት  GitHub   │
└─────────────────────────────────────────────────────────┘
```

The editor takes the **full width** and the panels sit **under** it. Ge'ez runs
wide and a condition-first conditional is a long line by design, so splitting
the width in two cost the editor the dimension it needed most. The panels lose
less by being short than the editor lost by being narrow: tokens, tree rows and
diagnostics are all lists, and a list scrolls.

The playground wears **the site's own header and footer**
(`tools/shared/chrome.css`), with its own toolbar between them holding the
things only it has: the example menu, the status line and the run button. It
is a page of the site — reachable from the nav of every other page, and able
to get back — rather than somewhere a reader lands with no way out.

Everything the two share lives in that one stylesheet, **including the base
type**. The playground does not load the site's own stylesheet, so a shared
component whose rules sit there renders differently on the two: when
`font-size` and `line-height` lived in `site.css` the shared header's brand
measured 31.3px on a lesson page and 25.6px here, and the footer did not
exist at all because its rules were in the file this page never loads.

The theme and the language are therefore the **site's**, under the keys in
`tools/shared/nav.ts`, not the playground's own. Arriving here from a lesson
changes neither. The site's pages write the language they are being read in,
which is how this page — the one URL that serves both — knows which to open
in, and its header links back into that same language.

The page is built from **surfaces rather than lines**: not one border. The
major regions are told apart by the **shade** they are painted, from one scale
of solid colours — a solid step reads as a different plane at any size, and the
longest edge on the page has nothing beside it for a shadow to fall across.
Smaller things stack a translucent layer over whatever shade they land on, so a
snippet inside a panel takes its own level without a shade of its own. Shadows
are kept for what genuinely floats: the tooltip, the input dialog, a control
under the pointer.

The rule has exactly one exception, and it is deliberately not a border: the
**focus ring** is an `outline`. A focus indicator has to be a line, because
its whole job is to say which single control out of many has the keyboard,
and a shade cannot say "this one" against a surface it might itself be
painted on. It is solid rather than translucent for the same reason it has to
exist at all — WCAG 2.2 §1.4.11 asks for 3:1 against what surrounds it, and a
translucent ring takes the colour of whatever it lands on. An outline also
takes no space in the layout, so nothing moves when it appears. Every
interactive thing on the page has one, which is a change: the nav links, the
lesson list, the contents, the prev/next cards and the editor itself used to
have none.

- A **line-number gutter** runs down the editor, and a **position readout**
  sits under it. The readout's column counts code points, so it agrees with
  the column in every diagnostic (LANGUAGE.md §2.2) — counting UTF-16 units
  instead would quietly disagree with the errors on the same screen.

  The editor therefore does **not** wrap: a wrapped line occupies several rows
  but has one number, so the gutter would drift out of step with the text as
  soon as a line got long. Long lines scroll sideways.

- A **ስተቶች** panel joins the three the first draft named, carrying the full
  text of every diagnostic. The tab shows a count.

  Entries are separated by a hairline rule and some space rather than framed
  individually: a panel of five errors is busy enough without five boxes in
  it. The offending line inside each does keep a surface of its own — its own
  background and its own gutter — because that is what distinguishes quoted
  code from prose. It is coloured by the editor's highlighter from the same
  tokens, so a snippet cannot disagree with the code it came from, and the
  diagnostic's span is underlined in place, which needs no caret row to line
  up — and so avoids the alignment trouble Ethiopic's variable width gives the
  CLI's `^^^` (§1).

  The code appears as a badge rather than bracketed: `[AH3003]` is how a
  plain-text stream has to say it, and a styled panel does not need the
  brackets. The invariant is the same either way — the code is always shown.

- Two toggles: **theme** (light and dark, following the system until someone
  chooses, then remembering the choice) and **language**, which switches the
  page's own text between Amharic and English.

  The language toggle does **not** translate a diagnostic's message. That text
  comes from the interpreter, where §9 of the language spec makes it
  normative — a learner reading `ያልታወቀ ተለዋጭ` is reading Ahadu, not this
  page. A second catalogue here would drift from the spec's own wording. The
  code beside it is already language-neutral, and the position line around it
  is the page's and is translated. The English side is for finding one's way
  around the tool: a teacher setting it up, or a reader of the spec who does
  not read Amharic.

- **Output** — what `ጻፍ` printed, plus the value of the last statement.
- **Tokens** — the live token table; hovering a row highlights its source span,
  and hovering source highlights the row.
- **AST** — the collapsible tree; selecting a node highlights its span.

### 2.1.1 On a phone

Below 760px the five sections of the site header move into a **drawer**,
opened by a button at the end of the bar, and the bar stays one row. Across a
390px screen they wrapped onto three, which spent a third of the screen on
chrome before the reader saw a line of code.

The drawer is a dialog and behaves like one: focus moves into it when it
opens and back to the button when it closes, Escape closes it, Tab stays
inside it, and a tap on the page behind closes it. It carries its own shade
and a shadow, because it genuinely floats.

It appears **only when scripting is on**, and the page says so by putting a
class on `<html>` before first paint. With scripting off the sections stay
the plain wrapped list they were: two rows of links is a worse header, and a
hamburger that cannot open is no site at all. The drawer is shared with the
site's pages (`tools/shared/menu.ts`), as the header it hangs from is.

The playground's own toolbar keeps its single row down to 320px by giving
ground in this order: the example menu narrows, then the status line stops
being **drawn** — but keeps being rendered, because it is the `aria-live`
region that announces "3 errors" and "finished". What a sighted reader loses
is the count, and the count is on the ስተቶች tab beside it.

### 2.1.2 Highlighting

The colours come from the lexer's own tokens (`tools/playground/highlight.ts`),
never from a second set of patterns — that is what makes it impossible for the
editor to colour something the language does not read that way. They live in
`tools/shared/syntax.css` so the site's snippets and this editor cannot
disagree; the palette and the reasoning behind each colour are in
`tools/shared/tokens.css`.

Three things beyond one colour per token type:

- **Brackets are coloured by nesting depth**, cycling every three levels, and
  `(` and `[` are counted on one counter — the way the lexer counts them
  (§3.5 of LANGUAGE.md) — so a `(` inside a `[` is a level deeper rather
  than a second first level. The three depths differ by lightness as well as
  hue, which is what makes depth legible with no colour vision at all.

- **The pair beside the caret is marked**, in the editor and in a lesson's
  snippet. Beside, not under: the caret is a gap between characters, so a
  bracket counts when the caret is on either side of it, and an editor that
  only lit the bracket to the right would go dark the moment you typed `)`.
  It is a wash and a weight rather than a colour, because the depth colour is
  information the reader may be using.

- **Ahadu's three Ethiopic marks are told apart.** `፦` opens a block and is
  painted like the keyword that leads up to it — it does the job a keyword
  does in an English-based language, so it should look like one. `።` ends a
  statement, and is weighted. `፣` separates, and is quieter, because it
  divides rather than ends. The ASCII `:` and `.` stay quiet: they are
  spellings that already read as punctuation to everyone.

### 2.2 Behavior

- Lexing and parsing re-run on every keystroke, debounced 150 ms. The Tokens
  and AST panels stay useful while the program is incomplete, which is what
  the error recovery in LANGUAGE.md §9.3 is for.

- Diagnostics mark their span in the editor — a wavy underline and a faint
  wash — and hovering one shows its code, message and position.

  There is no element to hover: the editor is a textarea with its text painted
  behind it, so the span under the pointer is worked out arithmetically from
  the pointer's offset, the line height and a measurement of the text in the
  editor's own font. That is only tractable because the editor does not wrap,
  so a row of pixels is exactly one source line. Where spans overlap, the
  narrowest wins, so a precise error inside a wider one is the one explained
  rather than the one buried.
- Evaluation runs only on **አሂድ**, in a Web Worker, with a step budget so an
  infinite loop cannot hang the tab. Exceeding it reports
  `ፕሮግራሙ ከመጠን በላይ ረዘመ` and offers a stop button.
- `አንብብ` reads from an **input dialog**, which አሂድ opens *before* starting a
  program that calls it. Each call takes the next line; a program that calls
  it more times than there are lines reads `""` (§9 of LANGUAGE.md).

  The timing is forced. `አንብብ` is synchronous, so that the whole interpreter
  can be, and the program runs in a worker — so it cannot stop half way and
  wait for an answer: a prompt on the main thread could only reach it through
  `SharedArrayBuffer` and `Atomics.wait`, which needs cross-origin isolation
  headers, and so would stop the page being static.

  What *can* be asked ahead of the run is whether the program will want input
  at all, because the call to `አንብብ` is right there in the tokens the page has
  already lexed for highlighting. So the dialog is driven by the program rather
  than by the user remembering to fill a box, and the page carries no input
  panel for the great majority of programs that never read anything.

  A name the program has rebound still counts as a call. Deciding otherwise
  would mean resolving scopes in the editor; offering an input box to someone
  who did not need one costs a keystroke, and missing one costs them their
  input. The answer is remembered, so a program can be re-run against the same
  input unchanged.
- The examples menu loads `examples/*.ahadu` from the repository, so the
  playground and the conformance suite exercise the same programs. A second
  group loads `examples/errors/*.ahadu`: programs that are meant to fail, so
  the ስተቶች panel has something to show. They live in their own directory
  because the conformance suite asserts that everything in `examples/` runs
  clean — which is exactly what they do not do.
- The editor's content is kept in `localStorage` so a reload does not lose
  work. Nothing is sent anywhere; the whole playground is static and runs the
  interpreter in the browser.

### 2.3 Build constraints

- The interpreter package must stay dependency-free and must run unchanged in
  Node and in a browser — no `node:` imports in `src/lexer`, `src/parser`, or
  `src/interpreter`. I/O (`አንብብ`, file reading) is injected by the host, so the
  playground supplies a modal-backed reader and the CLI supplies stdin.
- The playground is the only part of the repository allowed build-time
  dependencies.
- `src/library/` holds the standard library's Ahadu source as a string
  constant rather than as a `.ahadu` file, so that the CLI (Node), the
  playground and the site (Vite) and the tests (vitest) all load it the same
  way, with no build step and nothing to keep in sync (LANGUAGE.md §8.5).

### 2.4 Every host loads the standard library

`src/engine.ts` exports the `run` that loads the library, and it is what every
host calls: `src/cli/main.ts`, `src/cli/repl.ts` (through `withLibrary`, since
the REPL keeps one interpreter across entries), `tools/playground/evaluate.ts`
and `tests/helpers/run-source.ts`. The bare `run` in `src/interpreter/`
remains the library-free primitive, for tests that want nothing pre-bound
beyond the built-ins.

It is centralised for a specific reason. The four hosts do not share a code
path, and the realistic failure is not that someone forgets once — it is that
the **site build** forgets while the playground does not. The site's snippet
checker runs through `tools/playground/evaluate.ts`, so if those two diverged
the site would verify a different language from the one it teaches, silently,
which is the exact failure SITE.md §2 exists to prevent. A test asserts that
each of the four loads it.

## 3. Conformance suite

`tests/conformance/cases/*.ahadu` — each case is a program carrying its own
expectations in a header:

```ahadu
# expect: ሰላም ዓለም
# expect: 42
ጻፍ("ሰላም ዓለም")
ጻፍ(42)
```

```ahadu
# expect-error: AH3003 at 2:9
ሀ = 10
ለ = ሀ / 0
```

The runner lexes, parses, and evaluates each case, then compares captured
stdout line by line against the `# expect:` lines and the diagnostics against
the `# expect-error:` lines.

Expectations are **program behavior**, never token or AST snapshots. Snapshot
tests on intermediate stages are what let v1-ts ship an inverted `if`
(CHANGES-FROM-V1.md C01, C45): every snapshot agreed with the code, and no
test ran a real program. Stage-level tests live in `tests/unit` and are there to
localize a failure, not to define the language.

Every error code in LANGUAGE.md §9.2 must have at least one conformance case
that triggers it, and every example in `examples/` must appear as a case.
