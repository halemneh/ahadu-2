/**
 * What the editors suggest as you type (TOOLING.md §2.2.1).
 *
 * This file decides; `completion.ts` draws. Nothing here touches the DOM, so
 * every choice it makes — which word is being typed, what matches it, in what
 * order, and what goes into the text when one is picked — is covered by
 * `tests/unit/playground/complete.test.ts` without a browser.
 *
 * The candidates come from the same places the language does, never from a
 * list kept by hand beside it:
 *
 * - keywords from the lexer's own table (`KEYWORDS`), so a spelling variant
 *   the lexer accepts is one the editor completes;
 * - pre-bound functions from the reference's entries (`FN_ENTRIES`), which
 *   the site build already fails on if a pre-bound name lacks one;
 * - methods of the standard library's classes from the library's own parse;
 * - and the learner's names from lexing and parsing what they have written.
 *
 * Two kinds of loose matching, both because of how Ge'ez is typed:
 *
 * - **The last syllable matches by consonant.** Most Amharic keyboards type a
 *   consonant first and then change its vowel, so half way through a syllable
 *   the editor holds `ስ` where the reader is about to have `ሳ`. Holding the
 *   suggestions back until the vowel arrives would make them flicker.
 * - **Letters that sound alike match each other.** `ሀ`/`ሐ`/`ኀ`, `ሰ`/`ሠ`,
 *   `አ`/`ዐ` and `ጸ`/`ፀ` are one sound each in modern Amharic, and which one a
 *   word is spelled with is something people genuinely do not know. The
 *   suggestion offers the spelling the program actually uses — identifiers
 *   are compared by exact code points (LANGUAGE.md §3.1), so offering the
 *   reader's own spelling back would offer them an undefined name.
 *
 * And one kind of translation: an ASCII word matches the **English** idea of
 * a built-in or keyword, so `print` offers `ጻፍ` and `if` offers `ከሆነ`. A
 * reader on a keyboard with no Ge'ez layout can still write a program; one
 * who knows what a sort is but not its Amharic name finds `ደርድር`.
 */

import { KEYWORDS, isWordChar } from '../../src/lexer/index.js';
import type { KeywordType, Token } from '../../src/lexer/index.js';
import { tokenize } from '../../src/lexer/index.js';
import { parse } from '../../src/parser/index.js';
import type { Block, ClassDeclaration, Program, Statement } from '../../src/parser/index.js';
import { libraryProgram } from '../../src/library/index.js';
import { FN_ENTRIES, GLOSS } from '../site/build/functions.js';
import type { Language } from './nav.js';

export type Kind = 'keyword' | 'type' | 'function' | 'class' | 'variable' | 'member' | 'param';

export interface Suggestion {
  /** What the list shows, and what is matched against. */
  readonly label: string;
  /** What replaces the word being typed. */
  readonly insert: string;
  /** Where the caret lands, as a UTF-16 offset into `insert`. */
  readonly caret: number;
  readonly kind: Kind;
  /** One line beside the label: a signature, or what a keyword is for. */
  readonly detail: string;
  /** A sentence or two under the list for the one that is selected. */
  readonly doc: string;
  /** The English word that matched, when that is how it was found. */
  readonly via?: string;
}

/** The word being typed, as UTF-16 offsets into the source. */
export interface Context {
  readonly from: number;
  readonly to: number;
  readonly prefix: string;
  /** The word follows a `.`, so only attributes and methods make sense. */
  readonly member: boolean;
  /** Nothing but indentation stands before the word on its line. */
  readonly lineStart: boolean;
  /** Nothing but spaces follows the caret on its line. */
  readonly lineEnd: boolean;
}

export interface Completion {
  readonly context: Context;
  readonly items: readonly Suggestion[];
}

/** More than this and the list is a wall, not a choice. */
const LIMIT = 40;

// ---------------------------------------------------------------------------
// Where the caret is
// ---------------------------------------------------------------------------

/**
 * The word the caret is at the end of, or null where nothing should be
 * suggested: inside a string or a comment, or in a number.
 *
 * Only the caret's own line is scanned, which is enough because a string
 * cannot cross a line (LANGUAGE.md §3.6) and a comment runs to the end of
 * one (§2.3).
 */
export function contextAt(source: string, caret: number): Context | null {
  const lineFrom = source.lastIndexOf('\n', caret - 1) + 1;
  const newline = source.indexOf('\n', caret);
  const lineTo = newline === -1 ? source.length : newline;

  // Strings and comments, from the start of the line up to the caret.
  let quote: string | null = null;
  for (let i = lineFrom; i < caret; i += 1) {
    const ch = source[i] ?? '';
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#') {
      return null;
    }
  }
  if (quote !== null) return null;

  // Every word character Ahadu has is in the Basic Multilingual Plane, so
  // stepping back one UTF-16 unit at a time steps back one character.
  let from = caret;
  while (from > lineFrom && isWordChar(source[from - 1] ?? '')) from -= 1;
  const prefix = source.slice(from, caret);

  // `12` is a number, not the start of a name (§3.1).
  if (/^[0-9]/.test(prefix)) return null;

  return {
    from,
    to: caret,
    prefix,
    member:
      source[from - 1] === '.' && from - 1 > lineFrom && /[^\s.]/.test(source[from - 2] ?? ''),
    lineStart: source.slice(lineFrom, from).trim() === '',
    lineEnd: source.slice(caret, lineTo).trim() === '',
  };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Consonant rows whose sound is another row's, mapped onto it.
 *
 * Each Ethiopic consonant is a row of eight code points — seven vowels and a
 * labialised form — starting at a multiple of eight from U+1200, which is what
 * lets a syllable be split into its row and its vowel by arithmetic.
 */
const SAME_SOUND: Readonly<Record<number, number>> = {
  0x1210: 0x1200, // ሐ → ሀ
  0x1280: 0x1200, // ኀ → ሀ
  0x1220: 0x1230, // ሠ → ሰ
  0x12d0: 0x12a0, // ዐ → አ
  0x1340: 0x1338, // ፀ → ጸ
};

/** Rows whose first and fourth vowels are one sound: `ሀ`/`ሃ`, `አ`/`ኣ`. */
const FLAT_FOURTH: ReadonlySet<number> = new Set([0x1200, 0x12a0]);

/** A syllable's row and vowel, or null for anything that is not one. */
function syllable(char: string): { row: number; vowel: number } | null {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x1200 || code > 0x135a) return null;
  const offset = (code - 0x1200) % 8;
  const raw = code - offset;
  const row = SAME_SOUND[raw] ?? raw;
  return { row, vowel: FLAT_FOURTH.has(row) && offset === 3 ? 0 : offset };
}

/** One character, folded for loose comparison; `whole` keeps the vowel. */
function foldChar(char: string, whole: boolean): string {
  const s = syllable(char);
  if (s === null) return char.toLowerCase();
  return whole ? `${s.row}:${s.vowel}` : `${s.row}`;
}

/**
 * How well `candidate` continues `prefix`: 0 exactly, 1 loosely, or null.
 *
 * Loosely means every character but the last matches up to sound, and the
 * last matches by consonant alone — the one the reader may not have put a
 * vowel on yet.
 */
export function matchQuality(prefix: string, candidate: string): 0 | 1 | null {
  if (candidate.startsWith(prefix)) return 0;

  const p = [...prefix];
  const c = [...candidate];
  if (p.length === 0 || c.length < p.length) return null;
  for (let i = 0; i < p.length; i += 1) {
    const last = i === p.length - 1;
    if (foldChar(p[i] ?? '', !last) !== foldChar(c[i] ?? '', !last)) return null;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// The words of the language
// ---------------------------------------------------------------------------

/** English words for each keyword, for a reader with no Ge'ez keyboard. */
const KEYWORD_ENGLISH: Readonly<Partial<Record<KeywordType, string>>> = {
  IF: 'if',
  ELIF: 'elif elseif',
  ELSE: 'else otherwise',
  WHILE: 'while loop repeat',
  FOREACH: 'for foreach each loop',
  RETURN: 'return',
  FUNC: 'function def func fn',
  CLASS: 'class',
  INIT: 'init constructor',
  AND: 'and',
  OR: 'or',
  NOT: 'not',
  TRUE: 'true yes',
  FALSE: 'false no',
  NOTHING: 'nothing null none nil',
  TYPE_NUM: 'number int float num',
  TYPE_BOOL: 'bool boolean',
  TYPE_STRING: 'string text str',
  TYPE_LIST: 'list array',
};

/**
 * What a keyword's shape looks like, which is the thing a learner forgets.
 *
 * Ahadu puts the condition first (§7.3), so `ከሆነ` is not where a line
 * starts, and showing `ሁኔታ ከሆነ፦` says so without a word of explanation.
 */
const KEYWORD_USAGE: Readonly<Partial<Record<KeywordType, string>>> = {
  IF: '‹ሁኔታ› ከሆነ፦',
  ELIF: 'ግን ‹ሁኔታ› ከሆነ፦',
  ELSE: 'አለበለዚያ፦',
  WHILE: '‹ሁኔታ› እስከሆነ ድረስ፦',
  FOREACH: '‹ስብስብ› ለእያንዳንዱ ‹ስም›፦',
  RETURN: 'ተመላሽ ‹ዋጋ›',
  FUNC: 'ተግባር ‹ስም›(‹…›)፦',
  CLASS: 'ክላስ ‹ስም›፦',
  INIT: 'ፍጠር(‹…›)፦',
  TYPE_NUM: 'ቁጥር ‹ስም› = ‹ዋጋ›',
  TYPE_BOOL: 'እውነታ ‹ስም› = ‹ዋጋ›',
  TYPE_STRING: 'ጽሁፍ ‹ስም› = ‹ዋጋ›',
  TYPE_LIST: 'ስብስብ ‹ስም› = ‹ዋጋ›',
};

/**
 * What a keyword brings with it when it ends a line: the text after the
 * spelling, and where in that text the caret goes (the end, when absent).
 *
 * `፦` is the mark a reader is least likely to have on their keyboard, and
 * every block-opening keyword ends with it.
 */
const KEYWORD_TAIL: Readonly<Partial<Record<KeywordType, { text: string; caret?: number }>>> = {
  IF: { text: '፦' },
  ELIF: { text: '  ከሆነ፦', caret: 1 },
  ELSE: { text: '፦' },
  WHILE: { text: ' ድረስ፦' },
  FOREACH: { text: ' ' },
  RETURN: { text: ' ' },
  FUNC: { text: ' ' },
  CLASS: { text: ' ' },
  INIT: { text: '()፦', caret: 1 },
};

/** Keywords that begin a line, and those that never do. */
const STARTS_LINE: ReadonlySet<KeywordType> = new Set([
  'ELIF',
  'ELSE',
  'RETURN',
  'FUNC',
  'CLASS',
  'INIT',
  'TYPE_NUM',
  'TYPE_BOOL',
  'TYPE_STRING',
  'TYPE_LIST',
]);
const NEVER_STARTS_LINE: ReadonlySet<KeywordType> = new Set([
  'IF',
  'WHILE',
  'FOREACH',
  'AND',
  'OR',
]);

const KEYWORD_SPELLINGS: ReadonlyMap<KeywordType, readonly string[]> = ((): Map<
  KeywordType,
  string[]
> => {
  const map = new Map<KeywordType, string[]>();
  for (const [word, type] of Object.entries(KEYWORDS)) {
    // Reserved words have no syntax in 2.0 (AH2010); suggesting one would
    // suggest an error.
    if (type.startsWith('RESERVED_')) continue;
    map.set(type, [...(map.get(type) ?? []), word]);
  }
  return map;
})();

const UI: Record<
  Language,
  { definedAt: (line: number) => string; param: string; member: (of: string) => string }
> = {
  am: {
    definedAt: (line) => `መስመር ${line} ላይ የተገለጸ`,
    param: 'የዚህ ተግባር ግቤት',
    member: (of) => `የ${of} አባል`,
  },
  en: {
    definedAt: (line) => `Defined on line ${line}`,
    param: 'A parameter of this function',
    member: (of) => `A member of ${of}`,
  },
};

// ---------------------------------------------------------------------------
// Collecting candidates
// ---------------------------------------------------------------------------

interface Candidate extends Suggestion {
  /** English words this candidate may also be found by. */
  readonly english?: string;
  /** Lower comes first among equally good matches. */
  readonly rank: number;
}

/** A call's text, with the caret inside the parentheses unless none are taken. */
function call(
  name: string,
  takesArguments: boolean,
  parenFollows: boolean,
): Pick<Suggestion, 'insert' | 'caret'> {
  if (parenFollows) return { insert: name, caret: name.length };
  const insert = `${name}()`;
  return { insert, caret: takesArguments ? name.length + 1 : insert.length };
}

const BUILTIN_NAMES: ReadonlySet<string> = new Set(FN_ENTRIES.map((entry) => entry.name));

function builtins(language: Language, parenFollows: boolean): Candidate[] {
  const byName = new Map<string, (typeof FN_ENTRIES)[number][]>();
  for (const entry of FN_ENTRIES)
    byName.set(entry.name, [...(byName.get(entry.name) ?? []), entry]);

  return [...byName].map(([name, forms]) => {
    const first = forms[0] as (typeof FN_ENTRIES)[number];
    return {
      label: name,
      ...call(
        name,
        forms.some((form) => form.takes.length > 0),
        parenFollows,
      ),
      kind: 'function' as const,
      detail: forms.map((form) => form.sig).join('  ·  '),
      doc: language === 'am' ? first.am : first.en,
      english: [...new Set(forms.flatMap((form) => form.also.split(' ')))].join(' '),
      rank: 2,
    };
  });
}

function keywords(language: Language, prefix: string, context: Context): Candidate[] {
  const out: Candidate[] = [];
  for (const [type, spellings] of KEYWORD_SPELLINGS) {
    // The canonical spelling, unless the reader is typing a variant — then
    // the variant, since it is just as much Ahadu and is what they meant.
    const canonical = spellings[0];
    if (canonical === undefined) continue;
    const spelling =
      prefix !== '' && !canonical.startsWith(prefix)
        ? (spellings.find((word) => word.startsWith(prefix)) ?? canonical)
        : canonical;

    const tail = context.lineEnd ? KEYWORD_TAIL[type] : undefined;
    const insert = spelling + (tail?.text ?? '');
    const placement = context.lineStart
      ? STARTS_LINE.has(type)
        ? 0
        : NEVER_STARTS_LINE.has(type)
          ? 3
          : 1
      : STARTS_LINE.has(type)
        ? 3
        : 1;

    out.push({
      label: spelling,
      insert,
      caret: spelling.length + (tail?.caret ?? tail?.text.length ?? 0),
      kind: type.startsWith('TYPE_') ? 'type' : 'keyword',
      detail: KEYWORD_USAGE[type] ?? '',
      doc: GLOSS[type]?.[language] ?? '',
      english: KEYWORD_ENGLISH[type] ?? '',
      rank: placement,
    });
  }
  return out;
}

/** Every statement, however deeply nested in blocks. */
function* statements(body: readonly Statement[]): Generator<Statement> {
  for (const statement of body) {
    yield statement;
    const blocks: (Block | null)[] = [];
    switch (statement.type) {
      case 'IfStatement':
        blocks.push(
          statement.consequent,
          ...statement.elifs.map((e) => e.body),
          statement.alternate,
        );
        break;
      case 'WhileStatement':
      case 'ForEachStatement':
      case 'FunctionDeclaration':
        blocks.push(statement.body);
        break;
      default:
        break;
    }
    for (const block of blocks) if (block !== null) yield* statements(block.statements);
    if (statement.type === 'ClassDeclaration') {
      for (const method of statement.methods) yield* statements(method.body.statements);
      if (statement.constructor !== null) yield* statements(statement.constructor.body.statements);
    }
  }
}

function within(span: { line: number; endLine: number }, line: number): boolean {
  return line >= span.line && line <= span.endLine;
}

/** A class's members, for `x.` and for code inside the class itself. */
function members(
  cls: ClassDeclaration,
  language: Language,
  parenFollows: boolean,
  methodsOnly: boolean,
): Candidate[] {
  const doc = UI[language].member(cls.name);
  const out: Candidate[] = cls.methods.map((method) => ({
    label: method.name,
    ...call(method.name, method.params.length > 0, parenFollows),
    kind: 'member' as const,
    detail: `${method.name}(${method.params.join('፣ ')})`,
    doc,
    rank: 0,
  }));
  if (!methodsOnly) {
    for (const attribute of cls.attributes) {
      out.push({
        label: attribute.name,
        insert: attribute.name,
        caret: attribute.name.length,
        kind: 'member',
        detail: attribute.name,
        doc,
        rank: 0,
      });
    }
  }
  return out;
}

function libraryClasses(): ClassDeclaration[] {
  return libraryProgram().body.filter((s): s is ClassDeclaration => s.type === 'ClassDeclaration');
}

/** The names a program defines, and the ones in scope where the caret is. */
function fromProgram(
  program: Program,
  tokens: readonly Token[],
  caretLine: number,
  caretCol: number,
  language: Language,
  parenFollows: boolean,
): Candidate[] {
  const ui = UI[language];
  const out: Candidate[] = [];
  const named = new Set<string>();

  for (const statement of statements(program.body)) {
    if (statement.type === 'FunctionDeclaration') {
      named.add(statement.name);
      out.push({
        label: statement.name,
        ...call(statement.name, statement.params.length > 0, parenFollows),
        kind: 'function',
        detail: `${statement.name}(${statement.params.join('፣ ')})`,
        doc: ui.definedAt(statement.line),
        rank: 1,
      });
      if (within(statement, caretLine)) {
        for (const param of statement.params) {
          out.push({
            label: param,
            insert: param,
            caret: param.length,
            kind: 'param',
            detail: param,
            doc: ui.param,
            rank: 0,
          });
        }
      }
    } else if (statement.type === 'ClassDeclaration') {
      named.add(statement.name);
      const params = statement.constructor?.params ?? [];
      out.push({
        label: statement.name,
        ...call(statement.name, params.length > 0, parenFollows),
        kind: 'class',
        detail: `${statement.name}(${params.join('፣ ')})`,
        doc: ui.definedAt(statement.line),
        rank: 1,
      });
      // Inside a class its members are in scope by bare name — there is no
      // `self` (§7.6) — and so are the constructor's parameters.
      if (within(statement, caretLine)) {
        out.push(...members(statement, language, parenFollows, false));
        const ctor = statement.constructor;
        if (ctor !== null && within(ctor, caretLine)) {
          for (const param of ctor.params) {
            out.push({
              label: param,
              insert: param,
              caret: param.length,
              kind: 'param',
              detail: param,
              doc: ui.param,
              rank: 0,
            });
          }
        }
        for (const method of statement.methods) {
          if (!within(method, caretLine)) continue;
          for (const param of method.params) {
            out.push({
              label: param,
              insert: param,
              caret: param.length,
              kind: 'param',
              detail: param,
              doc: ui.param,
              rank: 0,
            });
          }
        }
      }
    }
  }

  // Everything else the program names. A name with `የ` refers to its stem's
  // object (§3.3), so it is the stem that is offered.
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.type !== 'IDENTIFIER') continue;
    // The word being typed is not a suggestion for itself.
    if (token.line === caretLine && token.startCol <= caretCol && token.endCol >= caretCol - 1) {
      continue;
    }
    const name = token.stem ?? String(token.value);
    // A call to a built-in names it too, but it is the built-in's own entry,
    // with its signature, that should be offered.
    if (named.has(name) || seen.has(name) || BUILTIN_NAMES.has(name)) continue;
    seen.add(name);
    out.push({
      label: name,
      insert: name,
      caret: name.length,
      kind: 'variable',
      detail: '',
      doc: ui.definedAt(token.line),
      rank: 1,
    });
  }

  return out;
}

/** A UTF-16 offset as a 1-based line and code-point column. */
function lineAndCol(source: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  let seen = 0;
  for (const char of source) {
    if (seen >= offset) break;
    seen += char.length;
    if (char === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

export interface Options {
  readonly language: Language;
  /**
   * Asked for with Ctrl+Space rather than arrived at by typing, so an empty
   * word still gets a list.
   */
  readonly explicit?: boolean;
}

/**
 * What to suggest with the caret at `caret`, or null for nothing.
 *
 * Exact matches come first, then loose ones, then English ones; within each,
 * what is in scope here, then the program's own names and the keywords, then
 * the built-ins — and shorter before longer, which puts `ጻፍ` above
 * `ጽሁፍ_አድርግ` once both match.
 */
export function complete(source: string, caret: number, options: Options): Completion | null {
  const context = contextAt(source, caret);
  if (context === null) return null;
  const { prefix } = context;
  if (prefix === '' && !options.explicit && !context.member) return null;

  const { language } = options;
  const parenFollows = source[caret] === '(';
  const { line, col } = lineAndCol(source, caret);

  const { tokens } = tokenize(source);
  const { program } = parse(tokens);

  let pool: Candidate[];
  if (context.member) {
    // Which class the object belongs to is a runtime fact, so every class's
    // members are offered. A wrong one is AH3012 when it runs — and with the
    // classes of a beginner's program, the list is short.
    const classes = [
      ...[...statements(program.body)].filter(
        (s): s is ClassDeclaration => s.type === 'ClassDeclaration',
      ),
    ];
    pool = [
      ...classes.flatMap((cls) => members(cls, language, parenFollows, false)),
      // The program's own classes first: a beginner's object is far more
      // likely to be one of theirs than a መዝገብ.
      ...libraryClasses()
        .flatMap((cls) => members(cls, language, parenFollows, true))
        .map((item) => ({ ...item, rank: 1 })),
    ];
  } else {
    pool = [
      ...fromProgram(program, tokens, line, col, language, parenFollows),
      ...keywords(language, prefix, context),
      ...builtins(language, parenFollows),
    ];
  }

  // English is only consulted for a word of two or more ASCII letters: one
  // letter matches half the dictionary.
  const english = /^[A-Za-z_]{2,}$/.test(prefix) ? prefix.toLowerCase() : null;

  const scored: { item: Candidate; quality: number }[] = [];
  const labels = new Set<string>();
  for (const item of pool) {
    let quality: number | null = prefix === '' ? 0 : matchQuality(prefix, item.label);
    let via: string | undefined;
    if (quality === null && english !== null && item.english !== undefined) {
      via = item.english.split(' ').find((word) => word.startsWith(english));
      if (via !== undefined) quality = 2;
    }
    if (quality === null) continue;
    // Typed in full already, with nothing more to add: not a suggestion.
    if (quality === 0 && item.label === prefix && item.insert === prefix) continue;
    if (labels.has(item.label)) continue;
    labels.add(item.label);
    scored.push({ item: via === undefined ? item : { ...item, via }, quality });
  }

  scored.sort(
    (a, b) =>
      a.quality - b.quality ||
      a.item.rank - b.item.rank ||
      [...a.item.label].length - [...b.item.label].length ||
      a.item.label.localeCompare(b.item.label),
  );

  const items = scored.slice(0, LIMIT).map(({ item }): Suggestion => {
    const { label, insert, caret: at, kind, detail, doc, via } = item;
    return via === undefined
      ? { label, insert, caret: at, kind, detail, doc }
      : { label, insert, caret: at, kind, detail, doc, via };
  });
  return items.length === 0 ? null : { context, items };
}

/** The source after `item` replaces the context's word, and the caret in it. */
export function apply(
  source: string,
  context: Context,
  item: Suggestion,
): { source: string; caret: number } {
  return {
    source: source.slice(0, context.from) + item.insert + source.slice(context.to),
    caret: context.from + item.caret,
  };
}
