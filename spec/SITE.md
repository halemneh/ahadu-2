# Ahadu — the website

> Normative for `tools/site/`. Where this document and the code disagree, the
> code is wrong. Companion to `TOOLING.md`, which covers the CLI and the
> playground; this covers the public site at **ahaducode.com**.

## 1. What the site is for

Ahadu exists so that someone can learn to program **in Amharic**. The site is
where that happens: it is the teaching surface, and the reference is secondary
to it.

That sets the priorities. A lesson that teaches is worth more than a page that
documents. Every idea is introduced by a program the reader can run and change
on the page. Nothing is explained in prose that could be shown by running two
lines of code.

## 2. The commitment that shapes everything

**Every Ahadu snippet on the site is executed by the real interpreter at build
time, and the build fails if a snippet's output is not what the page claims.**

This is not a nicety. v1 shipped a documented, 7,600-test, demonstrably wrong
language: conditionals were inverted and nothing caught it, because the tests
asserted on tree shapes and the documentation was prose nobody ran
(`CHANGES-FROM-V1.md`, C01). A teaching site full of code that was never run is
that same failure, aimed at beginners — who have no way to tell a typo in a
lesson from a misunderstanding of their own.

So the site's code samples are a conformance suite. They are lexed, parsed and
evaluated by `src/`, exactly as `tests/conformance/` is, and a mismatch is a
build error rather than a note in the margin.

The corollary: the site cannot be built from a copy of the language. It imports
the interpreter. Highlighting comes from the lexer's own tokens, keyword tables
come from `src/lexer/constants.ts`, and error codes come from
`src/diagnostics.ts`. Nothing about the language is retyped into the site, so
nothing about it can drift.

## 3. Two languages, two URL trees

Amharic is the default and English is complete, not a courtesy. Both are real
pages:

```
/              → redirects to /am/
/am/           /en/            home
/am/ተማር/…      /en/learn/…      lessons
/am/ማጣቀሻ/…     /en/reference/…  reference
/am/ምሳሌዎች      /en/examples     examples gallery
/playground                     the playground (TOOLING.md §2)
```

Separate URLs rather than the playground's in-place toggle, because prose is
not chrome: a lesson must be linkable, quotable and findable in the language it
was read in. The language switch is an anchor to the counterpart page, so it
never loses the reader's place.

Amharic is the default because the language is. `/` serving English would say
that Amharic is the translation.

## 4. Lessons

A lesson is one Markdown file per language, paired by path. Each has:

- a **title** and a one-line summary;
- prose broken by **runnable snippets**, not appended to them;
- an **exercise** at the end with a worked answer the reader can reveal.

Lessons are ordered and each names what it assumes. The order is the order a
beginner meets the ideas, not the order the grammar lists them.

### 4.1 Code fences

Fences carry what the build should check:

| Fence | Meaning |
| --- | --- |
| `ahadu` | A complete program. Must run without error. |
| `ahadu` + `ውጤት` fence after it | The next fence states the exact expected output. |
| `ahadu error=AH2008` | Must fail, with that code. This is how errors are taught. |
| `ahadu fragment` | Not a whole program; highlighted, never run. |

A snippet with no stated output still runs, so a lesson cannot contain a
program that crashes. A snippet that states output is checked character for
character. `fragment` is the one escape hatch and is deliberately awkward to
type, because it is the one that turns checking off.

### 4.2 Snippets are live

Every runnable snippet is an **embedded playground**: a Run button, output
underneath, and the editor is the snippet itself, so the reader can change it
in place. It runs in a worker with a step budget, by the same `evaluate.ts` the
playground uses.

Each also opens in the full playground, carrying its code in the URL fragment,
for anyone who wants the token and tree panels. The fragment rather than a
query string: a fragment is never sent to a server, and the playground's
promise that nothing goes anywhere (`TOOLING.md` §2) would be worth little if
every program a reader opened were in an access log.

The playground reads that fragment on load, and it wins over the saved draft —
someone who followed a link meant to see that program. The fragment stays in
the address bar afterwards, which makes the URL a permalink worth sharing.

The reader never has to leave a lesson to try something, and never has to set
anything up to begin. That is the whole argument for a site over a README.

## 5. Reference

The reference is generated from the implementation, not written beside it:

- **Keywords** from `KEYWORDS` in `src/lexer/constants.ts`.
- **Error codes** from `src/diagnostics.ts`, every one with an example that
  provokes it — which the build runs, so the catalogue cannot describe an error
  the language no longer raises.
- **Grammar** from `spec/GRAMMAR.ebnf`.

Prose around those tables is written by hand in both languages. The tables
themselves are never retyped.

## 6. Non-goals

- **No tracking, no analytics, no fonts fetched from anywhere.** The playground
  sends nothing anywhere (`TOOLING.md` §2), and the site keeps that promise.
  A beginner's first program is not telemetry.
- **No server.** Static files, so the site can be hosted anywhere and kept
  alive cheaply for as long as the language is useful.
- **No framework.** The playground established a design language and an
  interpreter-driven highlighter; a docs framework would fight both and bring a
  theme that knows nothing about Ge'ez.
