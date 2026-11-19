# `tools/playground`

Browser editor with live **ውጤት** (output), **ቶከኖች** (tokens), **ዛፍ** (AST) and
**ስተቶች** (errors) panels. Design is specified in
[`../../spec/TOOLING.md`](../../spec/TOOLING.md) §2.

```sh
npm run play          # dev server on localhost:5173
npm run play:build    # static files into tools/playground/dist/
```

| File | |
| --- | --- |
| `index.html` | the page; text carries `data-i18n` hooks rather than literals |
| `styles.css` | styles and both themes; no web font is fetched, so nothing is sent anywhere |
| `main.ts` | DOM glue: finds elements, wires events, paints strings |
| `view.ts` | what the panels show, plus line numbers and the position readout |
| `highlight.ts` | the editor's backdrop, coloured from the lexer's own tokens |
| `strings.ts` | the page's own text, in Amharic and English |
| `evaluate.ts` | running a program, and what comes back — no globals |
| `worker.ts` | binding `evaluate` to a worker's `self`, and nothing else |
| `vite.config.ts` | build; root is this directory, `base` is relative |

Three things worth knowing before changing it.

**The editor is a transparent `<textarea>` over a `<pre>`.** Both use the same
font and metrics, so they stay aligned without reimplementing text editing —
and that is what lets a diagnostic underline a span and a hovered panel row
light up its source. Change the font or padding of one and you must change the
other.

**The colours come from the lexer's tokens, not from a parallel set of regular
expressions.** So what the editor shows is by construction what Ahadu read: a
keyword variant the lexer accepts cannot fail to light up, and `ከሆነነገር` cannot
pretend to be a keyword. Comments are the one exception — they produce no
tokens at all, so `highlight.ts` finds a `#` in a column no token claimed,
which is also why a `#` inside a string is safe.

**`main.ts` holds no decisions.** Everything that chooses what appears lives in
`view.ts`, `highlight.ts` and `strings.ts`, which have no DOM access and are
covered by `tests/unit/playground/`. That split is the only reason the page is
tested at all: there is no browser in this project's test run.

**The editor does not wrap, and that is deliberate.** A wrapped line occupies
several rows on screen but has one number, so the gutter would drift out of
step with the text. `styles.css` uses `pre` rather than `pre-wrap` for that
reason; change it and the line numbers stop meaning anything.

**The language toggle does not translate diagnostics.** Their text comes from
the interpreter, where LANGUAGE.md §9 makes it normative. `strings.ts` says
more about why.

**The errors panel is additive.** It shows everything the lexer and the parser
found, and *then* a runtime error with its traceback — never one in place of
the others. It used to replace them, which made a file with five problems look
like it had one, and `evaluate` compounded it by returning only the first
diagnostic of the stage that stopped. Both are covered by
`tests/unit/playground/run-reply.test.ts`; keep them that way.

**A diagnostic's snippet uses `highlightLine`, not its own colouring.** Same
function as the editor's backdrop, same tokens, so a snippet cannot disagree
with the code it was taken from — there is a test asserting the snippet for a
line equals the editor's rendering of it. Marking the diagnostic's span also
underlines the offending characters in place, which is why there is no caret
row: nothing to align, and so none of the trouble Ethiopic's variable width
gives the CLI's `^^^`.
