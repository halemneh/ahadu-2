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
| `index.html` | the page |
| `styles.css` | styles; no web font is fetched, so nothing is sent anywhere |
| `main.ts` | DOM glue: finds elements, wires events, paints strings |
| `view.ts` | what the panels show, as functions from data to HTML |
| `highlight.ts` | the editor's backdrop, coloured from the lexer's own tokens |
| `worker.ts` | evaluation, off the main thread |
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
`view.ts` and `highlight.ts`, which have no DOM access and are covered by
`tests/unit/playground/`. That split is the only reason the page is tested at
all: there is no browser in this project's test run.
