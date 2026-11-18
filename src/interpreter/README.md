# `src/interpreter`

AST → values and effects. Governed by **LANGUAGE.md §4**, **§5.3**, **§6–9**.

Contract: `run(program: Program, host: Host) => [Value, Diagnostic | null]`.
Stops at the first runtime error. `Host` supplies `write(text)` and
`readLine(prompt?)` so the same evaluator runs under the CLI and in the
browser — no `node:` imports in this directory (TOOLING.md §2.3).

Things the spec pins down that are easy to get wrong here:

- Scope lookup is by **presence**, not truthiness: `0`, `""`, `ሃሰት`, `[]`, and
  `ምንም` are all defined values (§5.3, CHANGES C19).
- `ተመላሽ` returns immediately from anywhere in the function — use a return
  signal, not a syntactic guess about the last statement (§7.5, CHANGES C17).
- Conditions MUST be `እውነታ`; there is no implicit truthiness (§4.4).
- `ስብስብ + ስብስብ` concatenates; `አዋህድ` appends one element (§6.2, CHANGES C15).
- A slice's default end is `n`, not `n-1` (§6.5, CHANGES C16).
- Effective index is `i < 0 ? n + i : i`, checked against `0 … n-1` (§6.5).
- Integral numbers print with no decimal point (§4.2).
- Method resolution is dynamic, and a class with no `ፍጠር` inherits its
  parent's (§7.6).
