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
| Conformance corpus | 32 cases written, running once the pipeline lands |
| Lexer / Parser / Interpreter | not yet implemented |
| CLI / Playground | specified — [`spec/TOOLING.md`](spec/TOOLING.md) |

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
`አይነት` (type of) · `አንብብ` (read a line).

Both ASCII and Ethiopic forms work everywhere: `፦` or `:-`, `፣` or `,`, `‹` or
`<`, `&` or `እና`, `!` or `ተቃርኖ`, and `፳፩` or `21`. Write whichever your
keyboard gives you.

## Getting started

```sh
npm install
npm run check          # lint, format, build, test
```

Once the pipeline lands:

```sh
npm run repl                       # interactive አሃዱ> prompt
npx ahadu examples/01-ሰላም.ahadu    # run a program
npx ahadu tokens examples/02-ዑደት.ahadu   # see the lexer's output
npx ahadu ast examples/02-ዑደት.ahadu      # see the parse tree
npm run play                       # playground on localhost:5173
```

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
