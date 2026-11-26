/**
 * Markdown to HTML, with Ahadu fences turned into live snippets (SITE.md §4).
 *
 * Markdown is parsed by `marked`, a build-time dependency — nothing from it
 * reaches the browser. What this file adds is the handling of `ahadu` fences:
 * each is highlighted by the lexer's own tokens, run by the real interpreter,
 * checked against what the page claims, and rendered as something the reader
 * can edit and run in place.
 *
 * Highlighting a code sample with a hand-written regex is the obvious way to
 * do this and the wrong one: the site would then hold a second, worse
 * description of the language, free to disagree with the first. `highlight.ts`
 * takes tokens, so the samples are coloured by the same lexer that runs them.
 */

import { Marked } from 'marked';
import type { Token as MdToken, TokensList } from 'marked';
import { tokenize } from '../../../src/lexer/index.js';
import { highlight } from '../../playground/highlight.js';
import { escapeHtml } from '../../playground/view.js';
import { encodeProgram } from '../../shared/share.js';
import { parseInfo, verify } from './snippet.js';
import type { Snippet } from './snippet.js';
import type { Strings } from './strings.js';

/** Fence languages that state what a program should produce or consume. */
const OUTPUT_FENCE = new Set(['ውጤት', 'output']);
const INPUT_FENCE = new Set(['ግቤት', 'input']);

const marked = new Marked({ gfm: true });

/*
 * `marked`'s Token union includes a member with an index signature, so
 * narrowing by `type` still leaves every field `any`. These read the two
 * shapes this file cares about and *check* them rather than asserting: a
 * token that is not the shape expected is passed through as ordinary
 * Markdown instead of being treated as a code sample.
 */
interface CodeToken {
  readonly text: string;
  readonly lang: string;
  readonly raw: string;
}

interface HeadingToken {
  readonly text: string;
  readonly depth: number;
  readonly raw: string;
}

function asCode(token: MdToken): CodeToken | null {
  if (token.type !== 'code') return null;
  const fields = token as { text?: unknown; lang?: unknown; raw?: unknown };
  if (typeof fields.text !== 'string') return null;
  return {
    text: fields.text,
    lang: typeof fields.lang === 'string' ? fields.lang : '',
    raw: typeof fields.raw === 'string' ? fields.raw : '',
  };
}

function asHeading(token: MdToken): HeadingToken | null {
  if (token.type !== 'heading') return null;
  const fields = token as { text?: unknown; depth?: unknown; raw?: unknown };
  if (typeof fields.text !== 'string' || typeof fields.depth !== 'number') return null;
  return {
    text: fields.text,
    depth: fields.depth,
    raw: typeof fields.raw === 'string' ? fields.raw : '',
  };
}

/** An HTML token, which is how a rendered snippet re-enters the stream. */
function htmlToken(raw: string, text: string): MdToken {
  return { type: 'html', raw, pre: false, block: true, text };
}

export interface RenderInput {
  readonly markdown: string;
  /** Where this came from, so a failing snippet can be found. */
  readonly where: string;
  readonly strings: Strings;
  /** Prefix for links out of the page, e.g. `/am`. */
  readonly base: string;
}

export interface Rendered {
  readonly html: string;
  /** Headings, for the page's own contents list. */
  readonly headings: readonly { readonly id: string; readonly text: string }[];
  readonly snippets: number;
}

/**
 * Refuses an Ahadu fence the loop in `render` would not see.
 *
 * Only top-level fences are run. One inside a list item or a blockquote, or
 * one tagged `Ahadu` rather than `ahadu`, used to render as plain code and
 * pass the build unrun — the exact hole SITE.md §2 exists to close. Rather
 * than run them in place, the build says where they are, so a program on
 * this site is always one the checker found.
 */
function refuseUncheckable(tokens: TokensList, where: string): void {
  const topLevel = new Set<MdToken>(tokens);
  // `walkTokens` returns the results of async extensions; there are none here.
  void marked.walkTokens(tokens, (token) => {
    const fence = asCode(token);
    if (fence === null) return;
    const lang = fence.lang.trim();
    const word = lang.split(/\s+/)[0] ?? '';
    const ours = /^ahadu$/i.test(word) || OUTPUT_FENCE.has(word) || INPUT_FENCE.has(word);
    if (!ours) return;
    if (/^ahadu$/i.test(word) && word !== 'ahadu') {
      throw new Error(
        `${where}: write the fence as \`ahadu\`, in lowercase — \`${word}\` is not run`,
      );
    }
    if (!topLevel.has(token)) {
      throw new Error(
        `${where}: an \`${word}\` fence inside a list or a quote is not run by the build; move it to the top level`,
      );
    }
  });
}

export function render(input: RenderInput): Rendered {
  const tokens = marked.lexer(input.markdown);
  refuseUncheckable(tokens, input.where);
  const headings: { id: string; text: string }[] = [];
  let snippets = 0;

  const out: MdToken[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined) continue;

    const heading = asHeading(token);
    if (heading !== null && heading.depth === 2) {
      const id = slug(heading.text);
      headings.push({ id, text: heading.text });
      out.push(
        htmlToken(
          heading.raw,
          `<h2 id="${id}">${marked.parseInline(heading.text) as string}</h2>\n`,
        ),
      );
      continue;
    }

    const fence = asCode(token);
    if (fence === null || !fence.lang.startsWith('ahadu')) {
      out.push(token);
      continue;
    }

    // An `ahadu` fence may be followed by fences stating its input and its
    // expected output. They are consumed here so they never render as code.
    let expectedOutput: string | null = null;
    const inputLines: string[] = [];

    // `marked` puts a `space` token between blocks, so the following fence is
    // never the next token. Skipping those is what makes the lookahead work;
    // without it an output fence is left to render as a second code block,
    // and the page shows the answer twice.
    let j = i + 1;
    let consumed = i;
    while (j < tokens.length) {
      const next = tokens[j];
      if (next === undefined) break;
      if (next.type === 'space') {
        j += 1;
        continue;
      }

      const following = asCode(next);
      if (following === null) break;

      const lang = following.lang.trim();
      if (OUTPUT_FENCE.has(lang)) {
        expectedOutput = following.text.endsWith('\n') ? following.text : `${following.text}\n`;
      } else if (INPUT_FENCE.has(lang)) {
        inputLines.push(...following.text.split('\n'));
      } else {
        break;
      }

      j += 1;
      consumed = j - 1;
    }

    const { kind, expectedCode, varies } = parseInfo(fence.lang);
    const snippet: Snippet = {
      code: fence.text,
      kind,
      expectedOutput,
      expectedCode,
      input: inputLines,
      varies,
    };

    snippets += 1;
    out.push(htmlToken(fence.raw, renderSnippet(snippet, input)));

    // Only up to the last fence actually taken: trailing blank space belongs
    // to whatever comes next.
    i = consumed;
  }

  const list = out as TokensList;
  list.links = tokens.links;

  return { html: marked.parser(list), headings, snippets };
}

/**
 * Line numbers for a code sample: one per line of `source`, in a column of
 * their own beside the code.
 *
 * `aria-hidden` and unselectable, so a screen reader reads the program and
 * copying it copies the program — not "1 2 3" interleaved with it. The
 * numbers are the same ones every diagnostic refers to, which is the point
 * of having them on a page that teaches errors.
 */
export function lineGutter(source: string): string {
  const count = source.split('\n').length;
  const numbers = Array.from({ length: count }, (_, i) => String(i + 1)).join('\n');
  return `<pre class="snip-gutter" aria-hidden="true">${numbers}</pre>`;
}

/**
 * One snippet: highlighted source, and what it produces.
 *
 * The output shown is the output the build just saw, so a reader who never
 * presses Run is still looking at the truth. Pressing Run re-runs whatever
 * they have edited it into.
 */
function renderSnippet(snippet: Snippet, input: RenderInput): string {
  const result = verify(snippet, `${input.where}`);
  const { tokens } = tokenize(snippet.code);
  const code = highlight({ source: snippet.code, tokens });
  const s = input.strings;

  if (snippet.kind === 'fragment') {
    return `<div class="snip snip-fragment"><div class="snip-lines">${lineGutter(
      snippet.code,
    )}<pre class="snip-code"><code>${code}</code></pre></div></div>\n`;
  }

  // A `varies` snippet shows nothing until Run: what the build saw is a
  // fixed instant, not the reader's today.
  const shown =
    snippet.varies === true
      ? ''
      : snippet.kind === 'error'
        ? result.output
        : (snippet.expectedOutput ?? result.output);
  const note =
    snippet.kind === 'error'
      ? s.snippetFails
      : snippet.varies === true
        ? s.snippetVaries
        : s.snippetVerified;
  const outClass = snippet.kind === 'error' ? 'snip-out snip-out-bad' : 'snip-out';
  const hasOutput = shown.trim() !== '';

  // The textarea holds the source: it is what the reader edits and what Run
  // reads, so there is no second copy to fall out of step with the backdrop.
  return [
    `<div class="snip" data-kind="${snippet.kind}"${
      snippet.input.length > 0 ? ` data-input="${escapeHtml(snippet.input.join('\n'))}"` : ''
    } data-empty="${escapeHtml(s.noOutput)}"${snippet.varies === true ? ' data-varies' : ''}>`,
    `  <div class="snip-editor">`,
    `    ${lineGutter(snippet.code)}`,
    `    <div class="snip-layers">`,
    `    <pre class="snip-backdrop" aria-hidden="true"><code>${code}</code></pre>`,
    `    <textarea class="snip-input" spellcheck="false" rows="${
      snippet.code.split('\n').length
    }" aria-label="${escapeHtml(s.snippetLabel)}">${escapeHtml(snippet.code)}</textarea>`,
    `    </div>`,
    `  </div>`,
    `  <div class="snip-bar">`,
    `    <button class="snip-run" type="button">${escapeHtml(s.run)}</button>`,
    // The code is in the href from the start, so the link works before any
    // script runs — and `/playground/` outright, rather than a `..` that only
    // resolves because browsers normalise it.
    `    <a class="snip-open" href="/playground/#${encodeProgram(
      snippet.code,
    )}" data-open-playground>${escapeHtml(s.openInPlayground)}</a>`,
    `    <span class="snip-note">${escapeHtml(note)}</span>`,
    `  </div>`,
    `  <pre class="${outClass}"${hasOutput ? '' : ' hidden'}><code>${escapeHtml(shown)}</code></pre>`,
    `</div>`,
    '',
  ].join('\n');
}

/**
 * A heading's anchor.
 *
 * Ge'ez is kept as-is rather than transliterated: a URL may hold any character,
 * and an Amharic heading deserves an Amharic anchor. Only what would break a
 * fragment is replaced.
 */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s፣።፤፦"'`(){}[\]<>#?&=/\\.,:;!]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
