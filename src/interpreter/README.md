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
- Strings are immutable; lists are mutable references, so `ለ = ሀ` shares one
  list and `ቅጂ_አድርግ` is the only way to break the sharing (§4.3, §4.5).
- `ስብስብ + ስብስብ` concatenates into a **new** list, while `ጨምር` and `ሰርዝ`
  change the list in place and return `ምንም`. Keep the two halves apart
  (§4.5, §6.2, CHANGES C15).
- A slice's default end is `n`, not `n-1` (§6.5, CHANGES C16).
- Effective index is `i < 0 ? n + i : i`, checked against `0 … n-1` (§6.5).
- Integral numbers print with no decimal point (§4.2).
- Method resolution is dynamic, and a class with no `ፍጠር` inherits its
  parent's (§7.6).
- `ወደ_ቁጥር` and the lexer share one rule for what text is a number, in
  `src/numeric.ts`. They have to: a language that read `፫፻፳፩` from a file and
  refused the same digits typed at a prompt would be lying about its own
  numerals (§8.3).
- `ዘፈቀደ_ቁጥር` is seeded, and the **default seed is fixed, not clock-based**. The
  website runs every snippet through this interpreter at build time and fails
  the build when the output is not what the page claims (SITE.md §2), so a
  host that forgets `RunOptions.seed` must get a reproducible program rather
  than a flaky one. The CLI and the playground opt into variation explicitly
  (§8.4).

## The generator behind `ዘፈቀደ_ቁጥር`

**mulberry32**, seeded by truncating the `ቁጥር` to 32 bits. Chosen for being
nine lines with no dependencies and a state that is entirely those 32 bits, so
"the same seed gives the same sequence" is a property of the arithmetic rather
than a promise about a library.

It is **not** a CSPRNG and nothing in Ahadu should ever be used where one is
needed. It draws dice for a learner.

The spec requires only that a seed reproduce its sequence within an
implementation, so this choice is documented here rather than frozen in
`LANGUAGE.md`. That is also why conformance cases for `ዘፈቀደ_ቁጥር` assert properties
— a draw is within its bounds, the same seed repeats — rather than particular
numbers: the numbers are this file's, the properties are the language's.
- The standard library is Ahadu source, run as its own program through the
  same interpreter before the learner's (§8.5). Three things in this directory
  exist for it and are easy to break:
  - `execute` rebuilds the innermost frame on every statement. It must carry
    `fromLibrary` across, or a library error points at a line the learner
    never wrote.
  - `fail` reattributes an error raised inside a library function to the
    deepest frame the learner wrote. Not to the library frame's own `line` —
    `execute` keeps rewriting that to whichever statement is running, so by
    the time the error happens it is a line *inside* the library.
  - `fromLibrary` is provenance on the function value, not a name match. A
    learner who writes their own `ተግባር ደምር` must not have errors inside it
    reattributed as though it were library code.
