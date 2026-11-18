# `src/parser`

Tokens → AST. Governed by **LANGUAGE.md §5–7**, **GRAMMAR.ebnf**, and **§9.3**.

Contract: `parse(tokens) => { program, diagnostics }`. Never throws; always
returns a `Program`, with `InvalidExpression` placeholders where it could not
build a real node, so an editor can keep highlighting a half-typed file.

One method per grammar production, in the same order as `GRAMMAR.ebnf`, so the
two can be checked against each other by reading. `print.ts` renders a tree
for `ahadu ast` and the playground's AST panel.

Things the spec pins down that are easy to get wrong here:

- **The condition comes before the keyword**: parse an expression at statement
  start, then check whether the next token is `ከሆነ` or `እስከሆነ ድረስ` (§7.3,
  §7.4). This is CHANGES C01, the defect that made every original example
  program unparseable in v1-ts. One token of lookahead; no backtracking over
  the expression.
- Assignment is a statement, not an expression (§7.1, CHANGES C12).
- Comparison is non-associative — `ሀ < ለ < ሐ` is `AH2008` (§6.1).
- `^` binds tighter than unary minus: `-2 ^ 2` is `-(2 ^ 2)` (§6.1).
- Class bodies are structured — attributes, at most one `ፍጠር`, methods — not a
  plain statement list (§7.6, CHANGES C03).
- Slicing needs its own node; v1-ts had no way to represent it (CHANGES C04).
- Inside an unclosed `(` or `[`, newlines and indentation are skipped (§5.1).

Recovery is **one report per bad line**: after a diagnostic the parser goes
quiet until it resynchronizes at a line break (§9.3). Three things turned out
to matter for that, each learned by watching one mistake become two:

- A statement ending in a block has already consumed its line, so asking it
  for a terminator reports a phantom error against the *next* line.
- A statement that failed has already reported; it must not then be asked for
  a terminator either.
- When a block cannot be opened, the lines indented under it are its orphaned
  body, and must be swallowed rather than reported one by one.
