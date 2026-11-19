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
`--no-color`, `--help`.

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

These are the numbers the conformance suite asserts, on a 1,000-line program:
lexing under 50 ms, parsing under 100 ms. The budget exists so that the
playground can re-lex and re-parse on every keystroke.

### 1.6 `ahadu fmt`

Deferred past 2.0.0, but the shape is fixed now so the formatter does not have
to renegotiate the spec later: 4-space indentation, `፦` as the block marker,
`፣` as the list separator, one space around binary operators, no space inside
brackets.

## 2. Playground

`npm run play` serves a single page on `localhost:5173`.

### 2.1 Layout

```
┌───────────────────────────┬────────────────────────────┐
│                           │  Output │ Tokens │ AST     │
│   editor                  ├────────────────────────────┤
│   (Noto Serif Ethiopic)   │                            │
│                           │   active panel             │
│                           │                            │
├───────────────────────────┴────────────────────────────┤
│  ▸ አሂድ (run)   examples ▾           diagnostics: 0     │
└────────────────────────────────────────────────────────┘
```

- **Output** — what `ጻፍ` printed, plus the value of the last statement.
- **Tokens** — the live token table; hovering a row highlights its source span,
  and hovering source highlights the row.
- **AST** — the collapsible tree; selecting a node highlights its span.

### 2.2 Behavior

- Lexing and parsing re-run on every keystroke, debounced 150 ms. Diagnostics
  underline their span in the editor with the Amharic message on hover. The
  Tokens and AST panels stay useful while the program is incomplete, which is
  what the error recovery in LANGUAGE.md §9.3 is for.
- Evaluation runs only on **አሂድ**, in a Web Worker, with a step budget so an
  infinite loop cannot hang the tab. Exceeding it reports
  `ፕሮግራሙ ከመጠን በላይ ረዘመ` and offers a stop button.
- `አንብብ` resolves from a modal input prompt.
- The examples menu loads `examples/*.ahadu` from the repository, so the
  playground and the conformance suite exercise the same programs.
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
