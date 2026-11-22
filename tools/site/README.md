# The Ahadu website

The public site: home, lessons, a generated reference and the examples
gallery, in Amharic and English. `spec/SITE.md` is normative; this is the map.

```sh
npm run site          # dev server on localhost:5174, rebuilds as you write
npm run site:build    # static files into tools/site/dist/, playground included
npm run site:shot     # screenshots into tools/site/shots/
npm run site:smoke    # drives the dev server in a browser and checks it works
```

Run `site:smoke` after touching routing, the Vite config, or the link between
a lesson and the playground. It covers what the unit tests cannot: whether the
thing actually works when served.

## The one thing to know

**Every Ahadu snippet on this site is executed by the real interpreter at
build time, and a snippet whose output is not what the page claims fails the
build.**

That is not a nicety. v1 shipped a documented language whose conditionals ran
inverted, and 7,600 passing tests never noticed, because they asserted on tree
shapes and the documentation was prose nobody ran. A teaching site full of
code that was never run is that same failure, aimed at people who cannot tell
a typo in a lesson from a mistake of their own.

Writing the first seven lessons against that check corrected them four times.
Two of the corrections were interesting enough to become part of the lessons.

## Licence

Everything in `content/` is **CC BY-SA 4.0** ([LICENSE-CONTENT](../../LICENSE-CONTENT)),
not MIT like the rest of the repository. The boundary is this directory: prose
is share-alike, code is permissive. If you add a file here you are licensing it
that way, and if you move prose out of here you are changing its licence —
which is a decision, not a refactor.

## How content is written

One Markdown file per language, paired by the `id` in its front matter — not
by filename, since the filenames are in different scripts. A page in one
language with no counterpart in the other fails the build.

````markdown
---
id: loops
title: ድግግሞሽ
summary: አንድን ነገር ደጋግሞ መሥራት
order: 40
---

```ahadu
ቆጣሪ = 1
ቆጣሪ <= 3 እስከሆነ ድረስ፦
    ጻፍ(ቆጣሪ)
    ቆጣሪ = ቆጣሪ + 1
```

```ውጤት
1
2
3
```
````

| Fence | What the build does |
| --- | --- |
| `ahadu` | Runs it. It must not fail. |
| a `ውጤት` fence after it | Checks the output character for character. |
| a `ግቤት` fence after it | Serves those lines to `አንብብ`. |
| `ahadu error=AH2008` | Requires it to fail with that code. |
| `ahadu fragment` | Highlights it, never runs it. |

`fragment` is the only way to turn checking off, and it is deliberately
awkward to type. An unknown flag is a build error rather than something
ignored, because a typo that silently stopped the checking is the one way this
mechanism could fail without anyone noticing.

## Files

| File | What it does |
| --- | --- |
| `build/snippet.ts` | parses fence flags, runs samples, holds pages to their claims |
| `build/markdown.ts` | Markdown → HTML, with Ahadu fences becoming live snippets |
| `build/content.ts` | front matter, the content tree, cross-language pairing |
| `build/reference.ts` | keyword and error tables, generated from `src/` |
| `build/examples.ts` | the gallery, from the repository's own `examples/` |
| `build/layout.ts` | the page shell |
| `build/generate.ts` | ties it together, writes `.generated/` |
| `client/main.ts` | the only thing a browser is needed for |
| `theme/site.css` | the reading layout; palette is in `tools/shared/` |

The build modules are ordinary TypeScript imported by `vite.config.ts`, which
Vite transpiles — so the generator has the real interpreter in hand with no
extra tooling, and the logic stays testable by vitest
(`tests/unit/site/build.test.ts`).

## Things worth knowing before changing it

**Nothing about the language is retyped here.** Highlighting comes from the
lexer's tokens, the keyword table from `KEYWORDS`, the error catalogue from
`MESSAGES`, the examples from `examples/`. A hand-written regex highlighter
would be a second, worse description of Ahadu, free to disagree with the
first. A keyword type with no gloss fails the build rather than printing
`func` at a beginner.

**Snippets run inline, not in a worker.** The playground uses one because a
program there may be anything. Here the step budget turns a runaway loop into
a proper `AH3018` error in milliseconds, which is a better lesson than a hung
tab — and no page has to bundle a worker.

**The playground is a built snapshot in development.** `npm run site` builds
it into `.playground/` at startup and serves those files *directly*, bypassing
Vite. Both halves of that matter. It is not served from source, because a page
outside the root skips Vite's HTML transform and its relative imports then
resolve against the browser's URL. It is not served *through* Vite either,
because Vite re-transforms an already built bundle: it finds the worker's URL
inside, treats it as source to resolve again, and rewrites it to a path that
does not exist — so the page loads and every Run fails. To work on the
playground itself, use `npm run play`, which is what that script is for.

**Lessons hand code to the playground through the URL fragment**
(`tools/shared/share.ts`). The fragment, not a query string: a fragment is
never sent to a server, and the playground promises nothing goes anywhere.
The link carries the code from the build, so it works with JavaScript off, and
the client updates it as the reader edits — on input rather than on click,
because a click handler that rewrites its own href is racing the navigation.

**A reader with JavaScript off still gets the whole lesson**: prose, samples,
highlighting and verified output are all in the HTML. The script only adds
editing and re-running. That matters for readers on whatever device a school
has.

**Amharic is the default and `/` redirects to `/am/`.** Serving English at the
root would say that Amharic is the translation.
