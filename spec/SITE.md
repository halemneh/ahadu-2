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

### 3.1 Being findable

A reader who would want this site cannot reach it by accident. There is no
search term in English that leads here, and almost nothing links here. The one
person the site is for — somebody who wonders, in Amharic, whether they could
write a program in their own language — will type that wondering into a search
box, and the answer has to be in the index by then.

So the site states its own shape where a crawler looks for it:

- `sitemap.xml` lists every page, at absolute URLs, percent-encoded. This is
  not a nicety for the Amharic tree: `/am/ተማር/` is `/am/%E1%89%B0%E1%88%9B%E1%88%AD/`
  on the wire, and those are exactly the URLs with no inbound links to find
  them by.
- `robots.txt` disallows nothing and points at the sitemap.
- Every page carries a self-referencing `canonical`, and an `hreflang` set
  naming both languages and itself. The set must be reciprocal and complete or
  it is ignored, which makes a half-written one worse than none: it looks
  correct in the HTML and does nothing. `x-default` is the Amharic page, for
  the same reason `/` is.

Both files are generated from the pages the build just wrote, never from a
list kept beside them. A hand-maintained sitemap is wrong the first time a
section is renamed, and nothing tells you — the pages simply stop being found,
months later. A test asserts the sitemap matches the HTML actually on disk.

None of this is in tension with §6. Nothing here is fetched by a browser,
nothing identifies a reader, and nothing happens because a page was opened:
these are files a crawler may ask for, describing URLs that are already public.

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
  A beginner's first program is not telemetry. §6.1 draws the one line this
  rule has: nothing is requested *because a page was opened*.
- **No server.** Static files, so the site can be hosted anywhere and kept
  alive cheaply for as long as the language is useful. The one endpoint the
  site knows about (§6.1) is not part of serving it: with that endpoint gone,
  every page still works.
- **No framework.** The playground established a design language and an
  interpreter-driven highlighter; a docs framework would fight both and bring a
  theme that knows nothing about Ge'ez.

### 6.1 Nothing passive; a deliberate message is different

The rule above used to read as absolute, and read that way it forbade a reader
from telling us that a lesson is wrong. That is the wrong trade for a teaching
site: the people best placed to find a mistake are beginners, and the ones most
affected by it are the next beginners. So the rule is stated precisely rather
than loosened.

**Nothing is requested on page load.** No analytics, no beacon, no pixel, no
third-party script, no font, no `fetch` on a timer, nothing that happens
because a page was opened or read. A reader can open every page on this site
and the only requests made are for the site's own HTML, stylesheet and script.
That part is not negotiable and is not weakened by anything below. In
particular, a CAPTCHA or bot-check widget may not be loaded by a page's HTML,
because its script would be a third-party request on every page view — if one
is ever needed, it is fetched at the moment a reader opens the form.

**A message the reader chooses to send is allowed.** The footer has two
actions, and both begin with the reader deciding to act:

- **Report a problem** — a link to a GitHub issue, pre-filled at build time
  with the page's path and language. It is a link, so it needs no JavaScript
  and makes no request until it is followed; following it leaves the site, as
  clicking any link does.
- **Contact** — a form in a dialog, which POSTs once, when Send is pressed, to
  a single endpoint belonging to this project (`tools/contact-worker/`). It
  sends what the reader typed and the path and language of the page they were
  on, and nothing else: no identifier, no history, nothing retained between
  visits.

The distinction is consent, and it is the whole of it. Telemetry is a request
the reader did not make, about behaviour they did not report; those remain
banned. A message is a request the reader made, containing what they chose to
say. A site that allowed the first would be spying; a site that forbade the
second would be unreachable.

Two constraints follow, and they are requirements, not preferences:

- **The email field on the contact form is optional.** Many readers are
  schoolchildren. Telling us about a typo must never cost a child their email
  address, so the field is there only for a reader who wants an answer, and it
  is labelled as optional where they can see it rather than only in the markup.
  The form states in both languages what is sent and that it is used only to
  reply.
- **The form fails gracefully.** The endpoint may be blocked or unreachable —
  restricted connectivity is ordinary for part of this audience. On failure the
  page says so in the reader's language, keeps what they typed, and offers the
  GitHub link instead. A site is allowed to be unable to receive a message; it
  is not allowed to lose one.
