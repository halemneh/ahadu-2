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
import { tokenize } from '../../../src/lexer/index.js';
import { highlight } from '../../playground/highlight.js';
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
const BUILTIN_GLOSS: Record<
  string,
  {
    sig: string;
    gives: { am: string; en: string };
    am: string;
    en: string;
    eg: string;
    out: string;
  }
> = {
  ጻፍ: {
    sig: `ጻፍ(…)`,
    gives: { am: `ምንም`, en: `ምንም` },
    am: `እያንዳንዱን ግቤት በክፍተት ለያይቶ ይጽፋል፤ በመጨረሻም አዲስ መስመር።`,
    en: `Prints each argument separated by a space, then a newline.`,
    eg: `ጻፍ("ዕድሜ፦"፣ 22)`,
    out: `ዕድሜ፦ 22`,
  },
  ርዝመት: {
    sig: `ርዝመት(ጽሁፍ | ስብስብ)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `የፊደል ብዛት ወይም የዕቃ ብዛት። ፊደል የሚቆጠረው በግዕዝ ፊደል ነው እንጂ በባይት አይደለም።`,
    en: `How many letters, or how many elements. Letters are counted as Ge’ez characters, not bytes.`,
    eg: `ርዝመት("ሰላም")`,
    out: `3`,
  },
  ጨምር: {
    sig: `ጨምር(ስብስብ፣ ዕቃ)`,
    gives: { am: `ምንም`, en: `ምንም` },
    am: `ዕቃውን በስብስቡ መጨረሻ ላይ ይጨምራል። ስብስቡን ራሱ ይቀይራል።`,
    en: `Adds the item to the end of the list. Changes the list itself.`,
    eg: `ዝ = [1፣ 2]
ጨምር(ዝ፣ 3)
ጻፍ(ዝ)`,
    out: `[1፣ 2፣ 3]`,
  },
  ሰርዝ: {
    sig: `ሰርዝ(ስብስብ፣ ቦታ)`,
    gives: { am: `ምንም`, en: `ምንም` },
    am: `በዚያ ቦታ ያለውን ዕቃ ያስወግዳል። ቦታ ከዜሮ ይጀምራል፤ አሉታዊ ቁጥር ከመጨረሻው ይቆጥራል።`,
    en: `Removes the item at that position. Positions start at 0; a negative counts from the end.`,
    eg: `ዝ = [1፣ 2፣ 3]
ሰርዝ(ዝ፣ 0)
ጻፍ(ዝ)`,
    out: `[2፣ 3]`,
  },
  ቅጂ_አድርግ: {
    sig: `ቅጂ_አድርግ(ስብስብ)`,
    gives: { am: `ስብስብ`, en: `ስብስብ` },
    am: `ራሱን የቻለ አዲስ ስብስብ። ዋናውን ሳይነኩ ለመቀየር።`,
    en: `A new, independent list — for changing one without touching the original.`,
    eg: `ሀ = [1፣ 2]
ለ = ቅጂ_አድርግ(ሀ)
ጨምር(ለ፣ 3)
ጻፍ(ሀ)`,
    out: `[1፣ 2]`,
  },
  አይነት: {
    sig: `አይነት(ማንኛውም)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `የዋጋውን አይነት ስም ይሰጣል፦ ቁጥር፣ ጽሁፍ፣ እውነታ፣ ስብስብ፣ ተግባር፣ ምንም።`,
    en: `The name of the value’s type: ቁጥር, ጽሁፍ, እውነታ, ስብስብ, ተግባር or ምንም.`,
    eg: `ጻፍ(አይነት(5)፣ አይነት("ሀ"))`,
    out: `ቁጥር ጽሁፍ`,
  },
  አንብብ: {
    sig: `አንብብ() | አንብብ(ጽሁፍ)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `ከተጠቃሚው አንድ መስመር ያነባል። ግቤቱ ካለ አስቀድሞ እንደ ጥያቄ ይጻፋል። ሁልጊዜ ጽሁፍ ይመልሳል — ቁጥር ቢጻፍም።`,
    en: `Reads one line from the person running the program. The optional argument is printed first as a prompt. Always returns ጽሁፍ, even when they typed digits.`,
    eg: `ስም = አንብብ("ስም፦ ")`,
    out: `(ተጠቃሚው የጻፈው)`,
  },
  ወደ_ቁጥር: {
    sig: `ወደ_ቁጥር(ጽሁፍ | ቁጥር)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ጽሁፉ የሚወክለውን ቁጥር። በዙሪያው ያለ ክፍተት ችግር የለውም፤ የግዕዝ አኃዝም ይነበባል። ቁጥር ካልሆነ AH3019።`,
    en: `The number the text spells. Surrounding spaces are fine, and Ge’ez numerals are read too. AH3019 if it is not a number.`,
    eg: `ጻፍ(ወደ_ቁጥር(" ፳፩ ") + 1)`,
    out: `22`,
  },
  ወደ_ጽሁፍ: {
    sig: `ወደ_ጽሁፍ(ማንኛውም)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `ጻፍ የሚጽፈው ጽሁፍ። ቁጥርን ከጽሁፍ ጋር ለማገናኘት።`,
    en: `Exactly what ጻፍ would have printed — for joining a number onto text.`,
    eg: `ጻፍ(ወደ_ጽሁፍ(42) + "!")`,
    out: `42!`,
  },
  ቁጥር_ነው: {
    sig: `ቁጥር_ነው(ማንኛውም)`,
    gives: { am: `እውነታ`, en: `እውነታ` },
    am: `ወደ_ቁጥር ይሠራ አይሠራ ይናገራል። ምን ቢሰጠውም ፈጽሞ ስተት አያነሳም።`,
    en: `Whether ወደ_ቁጥር would succeed. Never raises an error, whatever it is given.`,
    eg: `ጻፍ(ቁጥር_ነው("12")፣ ቁጥር_ነው("ሰላም"))`,
    out: `እውነት ሃሰት`,
  },
  ዘፈቀደ_ቁጥር: {
    sig: `ዘፈቀደ_ቁጥር(ከ፣ እስከ)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ከሁለቱ ጫፎች ጨምሮ የአጋጣሚ ሙሉ ቁጥር — ስለዚህ ዘፈቀደ_ቁጥር(1፣ 6) ዳይስ ነው።`,
    en: `A random whole number, both ends included — so ዘፈቀደ_ቁጥር(1፣ 6) really is a die.`,
    eg: `ዘር(1)
ጻፍ(ዘፈቀደ_ቁጥር(1፣ 6))`,
    out: `4`,
  },
  ዘር: {
    sig: `ዘር(ቁጥር)`,
    gives: { am: `ምንም`, en: `ምንም` },
    am: `የአጋጣሚውን ቅደም ተከተል ያስጀምራል። ያው ዘር ያው ቁጥር ይሰጣል።`,
    en: `Restarts the random sequence. The same seed gives the same numbers.`,
    eg: `ዘር(7)
ጻፍ(ዘፈቀደ_ቁጥር(1፣ 100))`,
    out: `2`,
  },
  ወለል_ዋጋ: {
    sig: `ወለል_ዋጋ(ቁጥር)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ከሱ በታች ያለው ሙሉ ቁጥር። በአሃዱ ማካፈል ሁልጊዜ ክፍልፋይ ስለሚሰጥ ይህ ያስፈልጋል።`,
    en: `The whole number at or below it. Division always gives a fraction in Ahadu, so this is how you get a whole one.`,
    eg: `ጻፍ(ወለል_ዋጋ(7 / 2))`,
    out: `3`,
  },
  ጣሪያ_ዋጋ: {
    sig: `ጣሪያ_ዋጋ(ቁጥር)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ከሱ በላይ ያለው ሙሉ ቁጥር።`,
    en: `The whole number at or above it.`,
    eg: `ጻፍ(ጣሪያ_ዋጋ(7 / 2))`,
    out: `4`,
  },
  ቅርብ_ሙሉ_ቁጥር: {
    sig: `ቅርብ_ሙሉ_ቁጥር(ቁጥር)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ወደ ቀረበው ሙሉ ቁጥር። ግማሽ ወደ ላይ ይሄዳል።`,
    en: `To the nearest whole number; a half goes up.`,
    eg: `ጻፍ(ቅርብ_ሙሉ_ቁጥር(2.5))`,
    out: `3`,
  },
  ፍጹም_ዋጋ: {
    sig: `ፍጹም_ዋጋ(ቁጥር)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ከዜሮ ያለው ርቀት — የመቀነስ ምልክቱን ይጥላል።`,
    en: `Its distance from zero — the minus sign is dropped.`,
    eg: `ጻፍ(ፍጹም_ዋጋ(0 - 7))`,
    out: `7`,
  },
  ከፋፍል: {
    sig: `ከፋፍል(ጽሁፍ) | ከፋፍል(ጽሁፍ፣ መለያ)`,
    gives: { am: `ስብስብ`, en: `ስብስብ` },
    am: `ጽሁፉን ከፋፍሎ ስብስብ ይሰጣል። በአንድ ግቤት በክፍተት ይከፋፍላል፤ መለያ ከተሰጠ በዚያ።`,
    en: `Splits text into a list. With one argument it splits on spaces; with a separator, on that.`,
    eg: `ጻፍ(ከፋፍል("አበበ ከበደ"))`,
    out: `["አበበ"፣ "ከበደ"]`,
  },
  ጽሁፍ_አድርግ: {
    sig: `ጽሁፍ_አድርግ(ስብስብ) | ጽሁፍ_አድርግ(ስብስብ፣ መለያ)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `የስብስቡን ዕቃዎች አንድ ጽሁፍ ያደርጋል — የከፋፍል ተቃራኒ። ስብስብ ይቀበላል እንጂ ጽሁፍ አይቀበልም።`,
    en: `Makes one piece of text out of a list — the opposite of ከፋፍል. It takes a list, not text.`,
    eg: `ጻፍ(ጽሁፍ_አድርግ([1፣ 2፣ 3]፣ "-"))`,
    out: `1-2-3`,
  },
  ከርክም: {
    sig: `ከርክም(ጽሁፍ)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `ከጽሁፉ ሁለቱ ጫፎች ክፍተት ያስወግዳል።`,
    en: `Removes spaces from both ends of the text.`,
    eg: `ጻፍ("[" + ከርክም("  ሰላም  ") + "]")`,
    out: `[ሰላም]`,
  },
  ወደ_ግዕዝ: {
    sig: `ወደ_ግዕዝ(ቁጥር)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `ቁጥሩን በግዕዝ አኃዝ ይጽፋል። ከ፩ እስከ ፺፱፻፺፱፼፺፱፻፺፱ ያለ ሙሉ ቁጥር ብቻ፤ ዜሮ በግዕዝ አይጻፍም።`,
    en: `Writes the number in Ge’ez numerals. Whole numbers from 1 upward only — zero has no Ge’ez numeral.`,
    eg: `ጻፍ(ወደ_ግዕዝ(321))`,
    out: `፫፻፳፩`,
  },
  ዛሬ: {
    sig: `ዛሬ()`,
    gives: { am: `ስብስብ`, en: `ስብስብ` },
    am: `ዛሬ በኢትዮጵያ አቆጣጠር፦ [ዓመት፣ ወር፣ ቀን]።`,
    en: `Today in the Ethiopian calendar, as [year, month, day].`,
    eg: `ቀኑ = ዛሬ()
ጻፍ(ቀኑ[1])`,
    out: `(የዛሬው ወር)`,
  },
  ከግሪጎሪ: {
    sig: `ከግሪጎሪ(ዓመት፣ ወር፣ ቀን)`,
    gives: { am: `ስብስብ`, en: `ስብስብ` },
    am: `የግሪጎሪውን ቀን ወደ ኢትዮጵያው ይቀይራል። የሌለ ቀን AH3022 ነው።`,
    en: `Converts a Gregorian date to the Ethiopian one. A date that does not exist is AH3022.`,
    eg: `ጻፍ(ከግሪጎሪ(2024፣ 9፣ 11))`,
    out: `[2017፣ 1፣ 1]`,
  },
  ወር_መጠሪያ: {
    sig: `ወር_መጠሪያ(ቁጥር)`,
    gives: { am: `ጽሁፍ`, en: `ጽሁፍ` },
    am: `የወሩ ስም። ዓመቱ አሥራ ሦስት ወር አለው፤ አሥራ ሦስተኛው ጳጉሜ ነው።`,
    en: `The month’s name. The year has thirteen months; the thirteenth is ጳጉሜ.`,
    eg: `ጻፍ(ወር_መጠሪያ(3))`,
    out: `ኅዳር`,
  },
  ደምር: {
    sig: `ደምር(ስብስብ)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `የዕቃዎቹ ድምር። ባዶ ስብስብ ዜሮ ይሰጣል።`,
    en: `The sum of the elements; 0 for an empty list.`,
    eg: `ጻፍ(ደምር([1፣ 2፣ 3]))`,
    out: `6`,
  },
  ቁጠር: {
    sig: `ቁጠር(ስብስብ፣ ዕቃ)`,
    gives: { am: `ቁጥር`, en: `ቁጥር` },
    am: `ዕቃው በስብስቡ ውስጥ ስንት ጊዜ እንዳለ።`,
    en: `How many elements are equal to it.`,
    eg: `ጻፍ(ቁጠር([1፣ 2፣ 1]፣ 1))`,
    out: `2`,
  },
  ፈልግ: {
    sig: `ፈልግ(ስብስብ፣ ዕቃ)`,
    gives: { am: `ቁጥር ወይም ምንም`, en: `ቁጥር or ምንም` },
    am: `የመጀመሪያው ቦታ፤ ከሌለ ምንም። -1 አይመልስም — በአሃዱ -1 እውነተኛ ቦታ ነው።`,
    en: `The first position, or ምንም when it is absent. Not -1: in Ahadu -1 is a real position.`,
    eg: `ጻፍ(ፈልግ(["ሀ"፣ "ለ"]፣ "ለ"))`,
    out: `1`,
  },
  ከፍተኛው: {
    sig: `ከፍተኛው(ስብስብ)`,
    gives: { am: `ዕቃ`, en: `the element` },
    am: `ትልቁ ዕቃ።`,
    en: `The largest element.`,
    eg: `ጻፍ(ከፍተኛው([3፣ 9፣ 4]))`,
    out: `9`,
  },
  ዝቅተኛው: {
    sig: `ዝቅተኛው(ስብስብ)`,
    gives: { am: `ዕቃ`, en: `the element` },
    am: `ትንሹ ዕቃ።`,
    en: `The smallest element.`,
    eg: `ጻፍ(ዝቅተኛው([3፣ 9፣ 4]))`,
    out: `3`,
  },
  ደርድር: {
    sig: `ደርድር(ስብስብ)`,
    gives: { am: `ምንም`, en: `ምንም` },
    am: `ስብስቡን በቦታው ይደረድራል። ዋናውን ለማቆየት ቅጂ_አድርግ ተጠቀም።`,
    en: `Sorts the list in place. Use ቅጂ_አድርግ first to keep the original.`,
    eg: `ሁ = [3፣ 1፣ 2]
ደርድር(ሁ)
ጻፍ(ሁ)`,
    out: `[1፣ 2፣ 3]`,
  },
  ገልብጥ: {
    sig: `ገልብጥ(ስብስብ)`,
    gives: { am: `ምንም`, en: `ምንም` },
    am: `ስብስቡን በቦታው ይገለብጣል።`,
    en: `Reverses the list in place.`,
    eg: `ሁ = [1፣ 2፣ 3]
ገልብጥ(ሁ)
ጻፍ(ሁ)`,
    out: `[3፣ 2፣ 1]`,
  },
  መዝገብ: {
    sig: `መዝገብ()`,
    gives: { am: `መዝገብ`, en: `a መዝገብ` },
    am: `በቦታ ሳይሆን በስም የሚያገኙበት ማኅደር። ዘዴዎቹ፦ አስገባ፣ አግኝ፣ አለው፣ አውጣ፣ ብዛት፣ ቁልፎቹ።`,
    en: `A store you look things up in by name rather than by position. Its methods: አስገባ, አግኝ, አለው, አውጣ, ብዛት, ቁልፎቹ.`,
    eg: `ዕድሜ = መዝገብ()
ዕድሜ.አስገባ("አበበ"፣ 22)
ጻፍ(ዕድሜ.አግኝ("አበበ"))`,
    out: `22`,
  },
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
  const gives = s.code === 'am' ? 'ይመልሳል' : 'gives';
  return names
    .map((name) => {
      const g = BUILTIN_GLOSS[name] as NonNullable<(typeof BUILTIN_GLOSS)[string]>;
      const { tokens } = tokenize(g.eg);
      const example = highlight({ source: g.eg, tokens }).replace(/\n/g, '&#10;');
      return `<tr>
  <td class="ref-fn">
    <code class="ref-sig">${escapeHtml(g.sig)}</code>
    <span class="ref-gives">${escapeHtml(gives)} <code>${escapeHtml(g.gives[s.code])}</code></span>
  </td>
  <td>
    <p>${escapeHtml(g[s.code])}</p>
    <pre class="ref-eg"><code>${example}</code></pre>
    <p class="ref-out"><span>→</span> <code>${escapeHtml(g.out)}</code></p>
  </td>
</tr>`;
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
${wrapped(`<table class="ref ref-fns">${head}
  <tbody>
${glossRows(builtins, s)}
  </tbody>
</table>`)}

<h3>${escapeHtml(s.code === 'am' ? 'መደበኛው ቤተ-መጻሕፍት' : 'The standard library')}</h3>
<p>${escapeHtml(
    s.code === 'am'
      ? 'እነዚህ በአሃዱ ራሱ ተጽፈዋል፤ ልክ እንደ ራስህ ፕሮግራም ማንበብ ትችላቸዋለህ። ኮዱ ከታች አለ።'
      : 'These are written in Ahadu itself — you can read them as you would read your own program. The source is below.',
  )}</p>
${wrapped(`<table class="ref ref-fns">${head}
  <tbody>
${glossRows(library, s)}
  </tbody>
</table>`)}`;
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
