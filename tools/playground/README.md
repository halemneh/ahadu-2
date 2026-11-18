# `tools/playground`

Browser editor with live **Output**, **Tokens**, and **AST** panels, served by
`npm run play` on `localhost:5173`. Design is specified in
[`../../spec/TOOLING.md`](../../spec/TOOLING.md) §2.

Shape when it lands: `index.html`, `main.ts`, `vite.config.ts`, and a worker
that runs the interpreter with a step budget so an infinite loop in a learner's
program cannot hang the tab. It loads its examples from `examples/`, the same
programs the conformance suite runs.

This is the only part of the repository allowed build-time dependencies — the
interpreter core stays dependency-free.
