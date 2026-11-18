# Ahadu 2.0 — working notes

## The one rule

`spec/LANGUAGE.md` is normative. Where code and spec disagree, the **code** is
wrong. Changing behavior means editing the spec in the same change, not after.

Before touching a stage, read its `src/<stage>/README.md` — each one lists the
spec sections that govern it and the specific v1 defects not to reintroduce.

## Commands

```sh
npm run check     # lint + format:check + build + test — run before committing
npm test          # vitest
npm run build     # tsc
```

## Conventions

- TypeScript strict, ES modules, `.js` extensions in import specifiers
  (NodeNext resolution).
- `src/lexer`, `src/parser`, and `src/interpreter` are **dependency-free** and
  must run in both Node and a browser. No `node:` imports there — I/O is
  injected through a `Host`. Only `src/cli` and `tools/playground` may import
  `node:` or take dependencies.
- Positions are 1-based and inclusive (`line`, `startCol`, `endCol`), and
  columns count **code points**, not UTF-16 units.
- Lexer and parser never throw. They return `[result, diagnostics]` with
  diagnostics sorted by line, then `startCol`, then `endCol`.
- Error messages are Amharic text plus a stable `AHxxxx` code from
  LANGUAGE.md §9.2. Tooling matches the code; humans read the text.

## Adding a language feature

1. Specify it in `spec/LANGUAGE.md` (and `GRAMMAR.ebnf` if it is syntax).
2. Add a conformance case under `tests/conformance/cases/` — a whole program
   with `# expect:` or `# expect-error:` lines.
3. Implement it.
4. Add unit tests only to localize failures, not to define behavior.

## Amharic text

Keyword spelling variants are listed exhaustively in LANGUAGE.md §3.2 and are
the only place spelling folding happens — identifiers are compared by exact
code points, with no normalization. When writing Amharic in code or docs, copy
the exact strings from the spec rather than retyping them; several keyword
variants differ only by a single visually similar syllable (`ሀ`/`ሃ`/`ኀ`).
