# Ahadu 2.0 — አሃዱ

An Amharic programming language, built as a teaching tool for Amharic speakers
learning to program. Keywords, error messages, and identifiers are all in
Amharic — and, unlike a language with translated keywords bolted onto English
grammar, Ahadu follows **Amharic word order**:

```ahadu
ዕድሜ > 18 ከሆነ፦
    ጻፍ("ትልቅ ሰው")
አለበለዚያ፦
    ጻፍ("ልጅ")
```

The condition comes first, then `ከሆነ` ("if it is") — the way the clause is
ordered in Amharic. Same for loops: `ቆጣሪ < 5 እስከሆነ ድረስ፦`.

Ahadu was originally designed and built by Hailemichael Alemneh as a CS senior
project ([paper and presentation](https://github.com/halemneh/Ahadu)). 2.0 is a
specification-first rebuild in TypeScript.

## Status

| | |
| --- | --- |
| Language specification | **complete** — [`spec/LANGUAGE.md`](spec/LANGUAGE.md) |
| Gap analysis of v1 | **complete** — [`spec/CHANGES-FROM-V1.md`](spec/CHANGES-FROM-V1.md) |
| Conformance corpus | 54 cases, every error code in the spec exercised |
| **Lexer** | **done** |
| **Parser** | **done** |
| **Interpreter** | **done** |
| **CLI and REPL** | **done** |
| **Playground** | **done** — 1,308 tests |

Implementation order and the acceptance bar for each stage are in
[`ROADMAP.md`](ROADMAP.md).

2.0 starts from a written specification because the two predecessor
implementations did not agree on the language. The most serious disagreement:
the TypeScript rewrite parsed conditionals in *English* word order
(`ከሆነ x == 1:-`), which means no program from the original repository parsed
under it. That and 44 other conflicts, defects, and gaps are catalogued with
their resolutions in [`spec/CHANGES-FROM-V1.md`](spec/CHANGES-FROM-V1.md).

## The language in one page

```ahadu
# አስተያየት

ስም = "ኃይለሚካኤል"          # ተለዋጭ
ቁጥር ዕድሜ = 22            # አይነት ያለው ተለዋጭ (አማራጭ)
ቤተሰብ = ["ሰላም"፣ "መልኬ"]   # ስብስብ

ዕድሜ >= 18 ከሆነ፦          # ሁኔታ
    ጻፍ(ስም + " ትልቅ ሰው ነው")
ግን ዕድሜ > 12 ከሆነ፦
    ጻፍ("ታዳጊ")
አለበለዚያ፦
    ጻፍ("ልጅ")

ቆጣሪ = 0
ቆጣሪ < ርዝመት(ቤተሰብ) እስከሆነ ድረስ፦   # ዑደት
    ጻፍ(ቤተሰብ[ቆጣሪ])
    ቆጣሪ = ቆጣሪ + 1

ተግባር ትልቁ(ሀ፣ ለ)፦         # ተግባር
    ሀ > ለ ከሆነ፦
        ተመላሽ ሀ
    ተመላሽ ለ

ክላስ ተማሪ፦                # ክላስ
    ጽሁፍ ስም = ""
    ቁጥር ክፍል = 0

    ፍጠር(ስም_)፦
        ስም = ስም_

    ተግባር ደረጃ()፦
        ክፍል < 9 ከሆነ፦
            ተመላሽ "አንደኛ ደረጃ"
        ተመላሽ "ሁለተኛ ደረጃ"

ሃይሌ = ተማሪ("ኃይለሚካኤል")
የሃይሌ ክፍል = 10            # "the ክፍል of ሃይሌ"
ጻፍ(ሃይሌ.ደረጃ())
```

Types: `ቁጥር` (number) · `ጽሁፍ` (text) · `እውነታ` (boolean) · `ስብስብ` (list) ·
`ተግባር` (function) · `ክላስ` / object · `ምንም` (nothing).

Built-ins: `ጻፍ` (print) · `ርዝመት` (length) · `አዋህድ` (append) · `ሰርዝ` (remove) ·
`ቅጂ` (copy) · `አይነት` (type of) · `አንብብ` (read a line).

Lists are mutable and held by reference — `ዝ[0] = 9` works, `አዋህድ` appends in
place, and `ለ = ሀ` gives one list two names. Strings are immutable: build a new
one rather than changing a character. `ቅጂ` is how you stop sharing a list.

Both ASCII and Ethiopic forms work everywhere: `፦` or `:-`, `፣` or `,`, `‹` or
`<`, `&` or `እና`, `!` or `ተቃርኖ`, and `፳፩` or `21`. Write whichever your
keyboard gives you.

## Getting started

```sh
npm install
npm run check          # lint, format, build, test
```

Ahadu programs run today:

```sh
npm run build
node dist/cli/main.js                                # REPL
node dist/cli/main.js examples/03-ቤተሰብ.ahadu         # run a program
node dist/cli/main.js trace examples/04-ተግባሮች.ahadu  # watch it run
node dist/cli/main.js tokens examples/02-ዑደት.ahadu   # the token table
node dist/cli/main.js ast examples/02-ዑደት.ahadu      # the parse tree
node dist/cli/main.js check examples/02-ዑደት.ahadu    # diagnostics only
```

`trace` is the one worth seeing — it shows a recursion unfolding, with the
value every statement produced:

```
    4: ተመላሽ ሀ → 12
        9: ተመላሽ ቁ → 1
      10: ተመላሽ ፊቦናቺ(ቁ - 1) + ፊቦናቺ(ቁ - 2) → 2
```

```
Program [2:1-7:24]
└─ body:
   ├─ AssignmentStatement [2:1-2:19]
   │  ├─ target: Identifier ቁጥሮች [2:1-2:4]
   │  └─ value: ListLiteral [2:8-2:19]
   └─ WhileStatement [5:1-7:24]
      ├─ condition: BinaryExpression LT [5:1-5:21]
      └─ body: Block [6:5-7:24]
```

Errors are Amharic, carry their code, and point at the span:

```
[AH2001] ሁኔታው ከ"ከሆነ" በፊት መምጣት አለበት። ለምሳሌ፦ ዕድሜ > 18 ከሆነ፦: መስመር 4 ላይ: 1ኛው ካራክተር

    4: ከሆነ ዕድሜ > 18፦
       ^^^
```

The REPL keeps its bindings between entries, reads an indented block until a
blank line, and has `:tokens`, `:ast`, `:clear` and `:help`:

```
አሃዱ> ዕድሜ = 20
አሃዱ> ዕድሜ > 18 ከሆነ፦
   ...     ጻፍ("ትልቅ ሰው")
   ...
ትልቅ ሰው
አሃዱ> ዕድሜ * 2
40
```

And in the browser:

```sh
npm run play          # playground on localhost:5173
npm run play:build    # static files, no server needed
```

The playground colours the editor from the lexer's own token spans, so what it
shows is by construction what Ahadu read. Diagnostics underline their span as
you type, hovering a token or AST row lights up the source it covers, and the
program runs in a worker with a step budget — an endless loop reports
`AH3018` instead of freezing the tab. The whole page is static and sends
nothing anywhere.

Every stage of the interpreter is inspectable from the command line, and the
playground shows tokens and the AST live as you type. That is deliberate: the
interpreter is itself a teaching artifact. See [`spec/TOOLING.md`](spec/TOOLING.md).

## Layout

```
spec/
  LANGUAGE.md         normative language specification
  GRAMMAR.ebnf        formal grammar
  CHANGES-FROM-V1.md  every v1 conflict, defect, and gap, with resolutions
  TOOLING.md          CLI, playground, and conformance-suite design
src/
  lexer/              source text → tokens
  parser/             tokens → AST
  interpreter/        AST → values and effects
  cli/                the `ahadu` command
tests/
  conformance/        whole programs with expected output — defines the language
  unit/               stage-level tests — localize a failure
examples/             runnable Ahadu programs, also used by the playground
tools/playground/     browser editor with live token and AST panels
```

## How this repository works

1. **The spec is normative.** Where the code and `spec/LANGUAGE.md` disagree,
   the code is wrong. Changing behavior means changing the spec first, in the
   same pull request.
2. **Conformance cases are whole programs with expected output**, never token
   or AST snapshots. v1-ts had 7,600 lines of passing unit tests while parsing
   `ከሆነ` in the wrong word order, because nothing ever ran a real program.
3. **The interpreter core stays dependency-free** and runs unchanged in Node
   and in the browser. I/O is injected by the host.

## Acknowledgements

Ge'ez rendering uses [Noto Serif Ethiopic](https://fonts.google.com/noto/specimen/Noto+Serif+Ethiopic)
(SIL Open Font License).

## License

MIT © Hailemichael Alemneh
