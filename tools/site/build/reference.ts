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
import { LIBRARY_NAMES } from '../../../src/library/index.js';
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
const BUILTIN_GLOSS: Record<string, { sig: string; am: string; en: string }> = {
  ጻፍ: {
    sig: 'ጻፍ(…)',
    am: 'እያንዳንዱን ግቤት በክፍተት ለያይቶ ይጽፋል',
    en: 'prints its arguments, space-separated',
  },
  ርዝመት: {
    sig: 'ርዝመት(ጽሁፍ | ስብስብ)',
    am: 'የፊደል ወይም የዕቃ ብዛት',
    en: 'length, in code points or elements',
  },
  አዋህድ: { sig: 'አዋህድ(ስብስብ፣ ዕቃ)', am: 'ዕቃውን በስብስቡ ላይ ይጨምራል', en: 'appends to the list, in place' },
  ሰርዝ: { sig: 'ሰርዝ(ስብስብ፣ ቦታ)', am: 'ከስብስቡ ያንን ቦታ ያስወግዳል', en: 'removes that position, in place' },
  ቅጂ: { sig: 'ቅጂ(ስብስብ)', am: 'ራሱን የቻለ አዲስ ስብስብ', en: 'a shallow copy' },
  አይነት: { sig: 'አይነት(ማንኛውም)', am: 'የዋጋውን አይነት ስም', en: 'the name of the value’s type' },
  አንብብ: { sig: 'አንብብ() | አንብብ(ጽሁፍ)', am: 'አንድ መስመር ግቤት ያነባል', en: 'reads one line of input' },
  ወደቁጥር: { sig: 'ወደቁጥር(ጽሁፍ | ቁጥር)', am: 'ጽሁፉ የሚወክለውን ቁጥር', en: 'the number the text spells' },
  ወደጽሁፍ: { sig: 'ወደጽሁፍ(ማንኛውም)', am: 'ጻፍ የሚጽፈው ጽሁፍ', en: 'what ጻፍ would have printed' },
  ቁጥርነው: { sig: 'ቁጥርነው(ማንኛውም)', am: 'ወደቁጥር ይሠራ አይሠራ', en: 'whether ወደቁጥር would succeed' },
  አጋጣሚ: {
    sig: 'አጋጣሚ(ሀ፣ ለ)',
    am: 'ከሁለቱ ጫፎች ጨምሮ የአጋጣሚ ሙሉ ቁጥር',
    en: 'a random integer, both ends included',
  },
  ዘር: { sig: 'ዘር(ቁጥር)', am: 'የአጋጣሚውን ቅደም ተከተል ያስጀምራል', en: 'restarts the random sequence' },
  ወደታች: { sig: 'ወደታች(ቁጥር)', am: 'ከሱ በታች ያለው ሙሉ ቁጥር', en: 'the whole number at or below' },
  ወደላይ: { sig: 'ወደላይ(ቁጥር)', am: 'ከሱ በላይ ያለው ሙሉ ቁጥር', en: 'the whole number at or above' },
  አቅርብ: { sig: 'አቅርብ(ቁጥር)', am: 'ወደ ቀረበው ሙሉ ቁጥር', en: 'the nearest whole number; a half goes up' },
  ፍጹም: { sig: 'ፍጹም(ቁጥር)', am: 'ከዜሮ ያለው ርቀት', en: 'its distance from zero' },
  ከፋፍል: { sig: 'ከፋፍል(ጽሁፍ[፣ መለያ])', am: 'ጽሁፉን ከፋፍሎ ስብስብ ይሰጣል', en: 'splits text into a list' },
  አገናኝ: { sig: 'አገናኝ(ስብስብ[፣ መለያ])', am: 'የስብስቡን ዕቃዎች አገናኝቶ ጽሁፍ', en: 'joins a list into text' },
  ከርክም: { sig: 'ከርክም(ጽሁፍ)', am: 'ከጫፎቹ ክፍተት ያስወግዳል', en: 'trims surrounding whitespace' },
  ወደግዕዝ: { sig: 'ወደግዕዝ(ቁጥር)', am: 'ቁጥሩን በግዕዝ አኃዝ ይጽፋል', en: 'writes the number in Ge’ez numerals' },
  ዛሬ: { sig: 'ዛሬ()', am: 'ዛሬ በኢትዮጵያ አቆጣጠር፦ [ዓመት፣ ወር፣ ቀን]', en: 'today in the Ethiopian calendar' },
  ከግሪጎሪ: { sig: 'ከግሪጎሪ(ዓመት፣ ወር፣ ቀን)', am: 'የግሪጎሪውን ቀን ወደ ኢትዮጵያው', en: 'converts a Gregorian date' },
  ወርመጠሪያ: {
    sig: 'ወርመጠሪያ(ቁጥር)',
    am: 'የወሩ ስም — ዓመቱ አሥራ ሦስት ወር አለው',
    en: 'the month’s name; the year has thirteen',
  },

  ደምር: { sig: 'ደምር(ስብስብ)', am: 'የዕቃዎቹ ድምር', en: 'the sum of the elements' },
  ቁጠር: { sig: 'ቁጠር(ስብስብ፣ ዕቃ)', am: 'ዕቃው ስንት ጊዜ እንዳለ', en: 'how many elements equal it' },
  ፈልግ: { sig: 'ፈልግ(ስብስብ፣ ዕቃ)', am: 'የመጀመሪያው ቦታ፤ ከሌለ ምንም', en: 'the first position, or ምንም' },
  ከፍተኛው: { sig: 'ከፍተኛው(ስብስብ)', am: 'ትልቁ ዕቃ', en: 'the largest element' },
  ዝቅተኛው: { sig: 'ዝቅተኛው(ስብስብ)', am: 'ትንሹ ዕቃ', en: 'the smallest element' },
  ደርድር: { sig: 'ደርድር(ስብስብ)', am: 'ስብስቡን በቦታው ይደረድራል', en: 'sorts the list, in place' },
  ገልብጥ: { sig: 'ገልብጥ(ስብስብ)', am: 'ስብስቡን በቦታው ይገለብጣል', en: 'reverses the list, in place' },
  ካርታ: { sig: 'ካርታ()', am: 'የቁልፍ-ዋጋ ማኅደር (ክላስ)', en: 'a key–value map (a class)' },
};

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

function glossRows(names: readonly string[], s: Strings): string {
  const missing = names.filter((name) => BUILTIN_GLOSS[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`the reference has no meaning for: ${missing.join(', ')}`);
  }
  return names
    .map((name) => {
      const g = BUILTIN_GLOSS[name] as { sig: string; am: string; en: string };
      return `<tr><td class="ref-word"><code>${escapeHtml(g.sig)}</code></td><td>${escapeHtml(
        g[s.code],
      )}</td></tr>`;
    })
    .join('\n');
}

export function builtinTable(s: Strings): string {
  const { builtins, library } = preBound();
  const head = `<thead><tr><th>${s.code === 'am' ? 'ተግባር' : 'Function'}</th><th>${
    s.code === 'am' ? 'ምን እንደሚሠራ' : 'What it does'
  }</th></tr></thead>`;

  return `<p>${escapeHtml(
    s.code === 'am'
      ? 'እነዚህ ስሞች ቀድመው ተጭነዋል። ቁልፍ ቃላት አይደሉም፤ ስለዚህ በራስህ ኮድ ልትሸፍናቸው ትችላለህ — ያኔ ግን ስተቱ ይነግርሃል።'
      : 'These names are pre-bound. They are not keywords, so your own code may shadow them — and the error says so when it does.',
  )}</p>
${wrapped(`<table class="ref">${head}
  <tbody>
${glossRows(builtins, s)}
  </tbody>
</table>`)}

<h3>${escapeHtml(s.code === 'am' ? 'መደበኛው ቤተ-መጻሕፍት' : 'The standard library')}</h3>
<p>${escapeHtml(
    s.code === 'am'
      ? 'እነዚህ በአሃዱ ራሱ ተጽፈዋል፤ ልክ እንደ ራስህ ፕሮግራም ማንበብ ትችላቸዋለህ።'
      : 'These are written in Ahadu itself — you can read them as you would read your own program.',
  )}</p>
${wrapped(`<table class="ref">${head}
  <tbody>
${glossRows(library, s)}
  </tbody>
</table>`)}`;
}

export function referenceBody(s: Strings): string {
  const t = (am: string, en: string): string => (s.code === 'am' ? am : en);

  return `

## ${t('ቁልፍ ቃላት', 'Keywords')}

${keywordTable(s)}

## ${t('ተግባራት', 'Functions')}

${builtinTable(s)}

## ${t('የስተት ኮዶች', 'Error codes')}

${errorTable(s)}
`;
}

/** The grammar, read from the spec so the two cannot disagree. */
export function grammar(repoDir: string): string {
  return readFileSync(join(repoDir, 'spec/GRAMMAR.ebnf'), 'utf8');
}
