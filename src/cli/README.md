# `src/cli`

The `ahadu` command. Governed by **TOOLING.md §1**.

Subcommands: `run` (default), `tokens`, `ast`, `check`, `trace`, and the REPL
when given no file. `--json` on any of them emits machine-readable output.

Program output goes to stdout, diagnostics to stderr, so redirecting stdout
captures exactly what the program printed (TOOLING.md §1.4). This is the only
directory in `src/` allowed to import `node:` modules.
