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
import { escapeHtml } from '../../playground/view.js';
import type { Strings } from './strings.js';

/**
 * What each keyword group means, in both languages.
 *
 * Every type the lexer knows must appear here; `keywordTable` fails the build
 * on one that does not. Falling back to the internal type name would put
 * `func` and `init` in a reference meant for someone learning their first
 * language — a quiet wrong answer, which is the kind this project tries not
 * to ship.
 */
const GLOSS: Record<string, { am: string; en: string }> = {
  IF: { am: 'ሁኔታ', en: 'if' },
  ELIF: { am: 'ሌላ ሁኔታ ማስገቢያ', en: 'else-if lead-in' },
  ELSE: { am: 'አለበለዚያ', en: 'otherwise' },
  WHILE: { am: 'ድግግሞሽ', en: 'repeat while' },
  FOREACH: { am: 'ለእያንዳንዱ ዕቃ', en: 'repeat for each item' },
  RETURN: { am: 'ዋጋ መመለሻ', en: 'return a value' },
  FUNC: { am: 'ተግባር መግለጫ', en: 'define a function' },
  CLASS: { am: 'ክላስ መግለጫ', en: 'define a class' },
  INIT: { am: 'የክላስ መነሻ ተግባር', en: "a class's set-up method" },
  AND: { am: 'እና', en: 'and' },
  OR: { am: 'ወይም', en: 'or' },
  NOT: { am: 'አይደለም', en: 'not' },
  TRUE: { am: 'እውነት', en: 'true' },
  FALSE: { am: 'ሐሰት', en: 'false' },
  NOTHING: { am: 'ምንም', en: 'nothing' },
  TYPE_NUM: { am: 'የቁጥር አይነት', en: 'the number type' },
  TYPE_BOOL: { am: 'የእውነታ አይነት', en: 'the truth type' },
  TYPE_STRING: { am: 'የጽሁፍ አይነት', en: 'the text type' },
  TYPE_LIST: { am: 'የስብስብ አይነት', en: 'the collection type' },
  RESERVED_NEW: { am: 'ለወደፊት የተያዘ', en: 'reserved for a future version' },
  RESERVED_BREAK: { am: 'ለወደፊት የተያዘ', en: 'reserved for a future version' },
  RESERVED_CONTINUE: { am: 'ለወደፊት የተያዘ', en: 'reserved for a future version' },
  RESERVED_CHAR: { am: 'ለወደፊት የተያዘ', en: 'reserved for a future version' },
};

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
    s,
  );
}

/**
 * Puts a table in a box that can scroll sideways on a narrow screen.
 *
 * Two columns of Ge'ez do not fit across a phone, and the alternative —
 * shrinking the type — is the one thing a syllabary cannot take. The
 * wrapper is focusable and labelled because a scrolling region that cannot
 * be reached with a keyboard is a region some readers simply cannot read
 * (WCAG 2.2 §2.1.1); `role="region"` is what makes the name be announced.
 */
function wrapped(table: string, s: Strings): string {
  const label = escapeHtml(s.referenceTitle);
  return `<div class="table-wrap" role="region" aria-label="${label}" tabindex="0">
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
  s,
)}`;
    })
    .join('\n\n');
}

/** Everything generated, appended to the reference page's own prose. */
export function referenceBody(s: Strings): string {
  const t = (am: string, en: string): string => (s.code === 'am' ? am : en);

  return `

## ${t('ቁልፍ ቃላት', 'Keywords')}

${keywordTable(s)}

## ${t('የስተት ኮዶች', 'Error codes')}

${errorTable(s)}
`;
}

/** The grammar, read from the spec so the two cannot disagree. */
export function grammar(repoDir: string): string {
  return readFileSync(join(repoDir, 'spec/GRAMMAR.ebnf'), 'utf8');
}
