# `src/parser`

Tokens → AST. Governed by **LANGUAGE.md §5–7**, **GRAMMAR.ebnf**, and **§9.3**.

Contract: `parse(tokens: Token[]) => [Program, Diagnostic[]]`. Never throws;
always returns a `Program`, with error placeholders where it could not build a
real node, so an editor can keep highlighting a half-typed file.

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
