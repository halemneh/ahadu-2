# `src/lexer`

Source text → tokens. Governed by **LANGUAGE.md §2–3** and **§9.3**.

Contract: `tokenize(input: string | Uint8Array) => [Token[], Diagnostic[]]`.
Never throws, never stops at the first problem; diagnostics come back sorted by
line, then `startCol`, then `endCol`.

Things the spec pins down that are easy to get wrong here:

- Columns count **code points**, not UTF-16 units (§2.2).
- `የ` stays attached to its word; the token carries `hasOfPrefix` and `stem`
  (§3.3). This is CHANGES C23 — do not reintroduce the split.
- `እስከሆነ ድረስ` is one token spanning the separating space; `እስከሆነ` alone is
  `AH1004`, not an identifier (§3.8, CHANGES C11).
- Leading whitespace is normalized whole-run, then divided by 4 (§3.7).
- Every scanning loop must terminate on end of input — a comment on the last
  line with no trailing newline hung v1-py forever (CHANGES C22).
