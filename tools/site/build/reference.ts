/**
 * The reference, generated from the implementation (SITE.md §5).
 *
 * Not written beside the language: read out of it. The keyword table comes
 * from `KEYWORDS`, the error catalogue from `MESSAGES`, and the grammar from
 * `spec/GRAMMAR.ebnf`. Nothing about the language is retyped here, so nothing
 * here can drift from what the interpreter actually does — which is how v1
 * ended up with documentation that described a language it did not implement.
 *
 * The prose around these tables is hand-written in `content/`, in both
 * languages. Only the facts are generated.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEYWORDS } from '../../../src/lexer/constants.js';
import { MESSAGES } from '../../../src/diagnostics.js';
import { withLibrary } from '../../../src/engine.js';
import { LIBRARY_NAMES, LIBRARY_SOURCE } from '../../../src/library/index.js';
import { FN_ENTRIES, GLOSS } from './functions.js';
import type { FnEntry } from './functions.js';
import { tokenize } from '../../../src/lexer/index.js';
import { highlight } from '../../playground/highlight.js';
import { escapeHtml } from '../../playground/view.js';
import type { Strings } from './strings.js';

const STAGE_TITLE: Record<string, { am: string; en: string }> = {
  AH1: { am: 'የቃላት ስተቶች', en: 'Lexical errors' },
  AH2: { am: 'የአገባብ ስተቶች', en: 'Syntax errors' },
  AH3: { am: 'የአሂድ ስተቶች', en: 'Runtime errors' },
};

const STAGE_NOTE: Record<string, { am: string; en: string }> = {
  AH1: {
    am: 'ኮዱን ወደ ቃላት ሲከፋፈል የሚገኙ ስተቶች። ፕሮግራሙ ከመጀመሩ በፊት ይገኛሉ።',
    en: 'Found while splitting the text into tokens, before anything runs.',
  },
  AH2: {
    am: 'የቃላቱ አደራደር ሲመረመር የሚገኙ ስተቶች። እነዚህም ፕሮግራሙ ከመጀመሩ በፊት ይገኛሉ።',
    en: 'Found while reading the structure of the program, also before it runs.',
  },
  AH3: {
    am: 'ፕሮግራሙ እየሄደ ሳለ የሚከሰቱ ስተቶች። አንድ ስተት ሲገኝ አሂዱ ይቆማል።',
    en: 'Raised while the program runs. Evaluation stops at the first one.',
  },
};

/**
 * The keyword table, grouped by what each word does.
 *
 * Several spellings mean the same keyword — Amharic admits more than one
 * rendering of the same word (ከሆነ, ከሖነ, ከኆነ), and the lexer accepts all of
 * them. Grouping by meaning shows that, where an alphabetical list would make
 * three unrelated rows out of one idea.
 */
export function keywordTable(s: Strings): string {
  const groups = new Map<string, string[]>();
  for (const [word, type] of Object.entries(KEYWORDS)) {
    groups.set(type, [...(groups.get(type) ?? []), word]);
  }

  const missing = [...groups.keys()].filter((type) => GLOSS[type] === undefined);
  if (missing.length > 0) {
    throw new Error(`the reference has no meaning for: ${missing.join(', ')}`);
  }

  const rows = [...groups.entries()]
    .map(([type, words]) => {
      const meaning = GLOSS[type]?.[s.code] ?? type;
      return `<tr><td class="ref-word">${words
        .map((w) => `<code>${escapeHtml(w)}</code>`)
        .join(' ')}</td><td>${escapeHtml(meaning)}</td></tr>`;
    })
    .join('\n');

  return wrapped(
    `<table class="ref">
  <thead><tr><th>${s.code === 'am' ? 'ቃል' : 'Keyword'}</th><th>${
    s.code === 'am' ? 'ትርጉም' : 'Meaning'
  }</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>`,
  );
}

/**
 * Puts a table in a box that can scroll sideways rather than overflow the
 * page.
 *
 * It is insurance, not the plan: the table is sized to fit at any width,
 * because two columns that wrap read better than two columns you have to
 * drag. The alternative — shrinking the type until it fits — is the one
 * thing a syllabary cannot take.
 *
 * No `tabindex` or `role` on the wrapper. A scrolling region does need to be
 * reachable from a keyboard, but this one does not scroll at any width the
 * audit measures, and a tab stop that does nothing is worse than none;
 * browsers make a container that genuinely overflows focusable by
 * themselves. The tables are already announced by the headings above them.
 */
function wrapped(table: string): string {
  return `<div class="table-wrap">
${table}
</div>`;
}

/** The error catalogue, one section per stage. */
export function errorTable(s: Strings): string {
  const stages = ['AH1', 'AH2', 'AH3'];
  const codes = Object.keys(MESSAGES).sort();

  return stages
    .map((stage) => {
      const rows = codes
        .filter((code) => code.startsWith(stage))
        .map(
          (code) =>
            `<tr><td><code id="${code}">${code}</code></td><td>${escapeHtml(
              MESSAGES[code] ?? '',
            )}</td></tr>`,
        )
        .join('\n');

      return `<h3>${escapeHtml(STAGE_TITLE[stage]?.[s.code] ?? stage)}</h3>
<p>${escapeHtml(STAGE_NOTE[stage]?.[s.code] ?? '')}</p>
${wrapped(
  `<table class="ref">
  <thead><tr><th>${s.code === 'am' ? 'ኮድ' : 'Code'}</th><th>${
    s.code === 'am' ? 'መልእክት' : 'Message'
  }</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>`,
)}`;
    })
    .join('\n\n');
}

/** Everything generated, appended to the reference page's own prose. */

/**
 * What each pre-bound name does, in both languages.
 *
 * The *list* of names is not here — it is read out of a real interpreter
 * below, so the reference cannot miss one. This only supplies the prose, and
 * `builtinTable` fails the build on a name it has nothing to say about. That
 * is the same arrangement as the keyword table, for the same reason: in v1 the
 * documentation was written beside the language and described a language the
 * implementation did not have.
 */
/**
 * The names a program actually finds pre-bound, read from a real interpreter
 * with the standard library loaded — not retyped here.
 */
function preBound(): { builtins: string[]; library: string[] } {
  const interpreter = withLibrary({ write: () => {}, readLine: () => '' });
  const library = new Set<string>(LIBRARY_NAMES);
  const all = interpreter.globals.ownNames();
  return {
    builtins: all.filter((name) => !library.has(name)),
    library: all.filter((name) => library.has(name)),
  };
}

/**
 * The functions, as cards rather than table rows.
 *
 * A table forced each entry into a line, and these entries have four things
 * to say: what it takes, what it gives back, why it behaves as it does, and
 * what an example prints. They are given the room.
 */
function card(entry: FnEntry, s: Strings): string {
  const { tokens } = tokenize(entry.eg);
  const code = highlight({ source: entry.eg, tokens }).replace(/\n/g, '&#10;');
  const takesLabel = s.code === 'am' ? 'ይቀበላል' : 'Takes';
  const givesLabel = s.code === 'am' ? 'ይመልሳል' : 'Gives back';
  const noneLabel = s.code === 'am' ? 'ምንም ግቤት የለውም' : 'nothing';

  const params =
    entry.takes.length === 0
      ? `<p class="fn-none">${escapeHtml(noneLabel)}</p>`
      : `<dl class="fn-params">${entry.takes
          .map(
            (t) => `<dt><code>${escapeHtml(t.n)}</code> <span>${escapeHtml(t.t)}</span></dt>
<dd>${escapeHtml(t[s.code])}</dd>`,
          )
          .join('\n')}</dl>`;

  return `<section class="fn" id="fn-${encodeURIComponent(entry.sig)}">
  <h3 class="fn-sig"><code>${escapeHtml(entry.sig)}</code></h3>
  <p class="fn-lead">${escapeHtml(entry[s.code])}</p>

  <div class="fn-io">
    <div>
      <h4>${escapeHtml(takesLabel)}</h4>
      ${params}
    </div>
    <div>
      <h4>${escapeHtml(givesLabel)}</h4>
      <dl class="fn-params">
        <dt><code>${escapeHtml(entry.gives[s.code])}</code></dt>
        <dd>${escapeHtml(s.code === 'am' ? entry.givesAm : entry.givesEn)}</dd>
      </dl>
    </div>
  </div>

  <pre class="fn-eg"><code>${code}</code></pre>
  <p class="fn-out"><span aria-hidden="true">→</span> <code>${escapeHtml(entry.out)}</code></p>
</section>`;
}

function cards(names: readonly string[], s: Strings): string {
  const known = new Set(FN_ENTRIES.map((entry) => entry.name));
  const missing = names.filter((name) => !known.has(name));
  if (missing.length > 0) {
    throw new Error(`the reference has no meaning for: ${missing.join(', ')}`);
  }
  const wanted = new Set(names);
  return FN_ENTRIES.filter((entry) => wanted.has(entry.name))
    .map((entry) => card(entry, s))
    .join('\n\n');
}

export function builtinTable(s: Strings): string {
  const { builtins, library } = preBound();

  // Every entry must name something that is actually pre-bound, or the page
  // documents a function nobody can call.
  const bound = new Set([...builtins, ...library]);
  const ghosts = FN_ENTRIES.filter((entry) => !bound.has(entry.name)).map((entry) => entry.name);
  if (ghosts.length > 0) {
    throw new Error(`the reference documents names that are not pre-bound: ${ghosts.join(', ')}`);
  }

  return `<p>${escapeHtml(
    s.code === 'am'
      ? 'እነዚህ ስሞች ቀድመው ተጭነዋል። ቁልፍ ቃላት አይደሉም፤ ስለዚህ በራስህ ኮድ ልትሸፍናቸው ትችላለህ — ያኔ ግን ስተቱ ይነግርሃል።'
      : 'These names are pre-bound. They are not keywords, so your own code may shadow them — and the error says so when it does.',
  )}</p>

<div class="fns">
${cards(builtins, s)}
</div>

<h3 class="fns-head">${escapeHtml(s.code === 'am' ? 'መደበኛው ቤተ-መጻሕፍት' : 'The standard library')}</h3>
<p>${escapeHtml(
    s.code === 'am'
      ? 'እነዚህ በአሃዱ ራሱ ተጽፈዋል፤ ልክ እንደ ራስህ ፕሮግራም ማንበብ ትችላቸዋለህ። ኮዱ ከታች አለ።'
      : 'These are written in Ahadu itself — you can read them as you would read your own program. The source is below.',
  )}</p>

<div class="fns">
${cards(library, s)}
</div>`;
}

export function librarySource(s: Strings): string {
  const { tokens } = tokenize(LIBRARY_SOURCE);
  return `<p>${escapeHtml(
    s.code === 'am'
      ? 'ከታች ያለው ኮድ ነው — መግለጫው አይደለም። ቋንቋው ራሱ የሚጭነው ይኸው ነው፤ ዑደቱና ሁኔታው አስቀድመህ የምታውቃቸው ናቸው።'
      : 'Below is the code, not a description of it. This is what the language loads, and the loops and conditions in it are the ones you already know.',
  )}</p>
<div class="snip snip-fragment"><pre class="snip-code"><code>${highlight({
    source: LIBRARY_SOURCE,
    tokens,
  }).replace(/\n/g, '&#10;')}</code></pre></div>`;
}

export function referenceBody(s: Strings): string {
  const t = (am: string, en: string): string => (s.code === 'am' ? am : en);

  return `

## ${t('ቁልፍ ቃላት', 'Keywords')}

${keywordTable(s)}

## ${t('ተግባራት', 'Functions')}

${builtinTable(s)}

## ${t('የቤተ-መጻሕፍቱ ኮድ', 'The library’s source')}

${librarySource(s)}

## ${t('የስተት ኮዶች', 'Error codes')}

${errorTable(s)}
`;
}

/** The grammar, read from the spec so the two cannot disagree. */
export function grammar(repoDir: string): string {
  return readFileSync(join(repoDir, 'spec/GRAMMAR.ebnf'), 'utf8');
}
