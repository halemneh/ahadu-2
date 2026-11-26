/**
 * What the editors suggest (TOOLING.md §2.2.1).
 *
 * `complete.ts` has no DOM, so this is where the suggestion list is tested:
 * which word the caret is in, what matches it, in what order, and what
 * picking one does to the text.
 */

import { describe, expect, it } from 'vitest';
import { apply, complete, contextAt, matchQuality } from '../../../tools/shared/complete.js';
import type { Options } from '../../../tools/shared/complete.js';

const am: Options = { language: 'am' };

/** Suggestions with the caret where `|` is, as labels. */
function labels(marked: string, options: Options = am): string[] {
  const caret = marked.indexOf('|');
  const source = marked.replace('|', '');
  return complete(source, caret, options)?.items.map((item) => item.label) ?? [];
}

/** The text after accepting the suggestion labelled `label`, caret as `|`. */
function accept(marked: string, label: string): string {
  const caret = marked.indexOf('|');
  const source = marked.replace('|', '');
  const found = complete(source, caret, am);
  const item = found?.items.find((i) => i.label === label);
  if (found === null || item === undefined) throw new Error(`no suggestion ${label}`);
  const next = apply(source, found.context, item);
  return `${next.source.slice(0, next.caret)}|${next.source.slice(next.caret)}`;
}

describe('contextAt', () => {
  it('finds the Ge’ez word before the caret', () => {
    const source = 'ጻፍ(ቆጣ)';
    expect(contextAt(source, 5)).toMatchObject({ from: 3, to: 5, prefix: 'ቆጣ', member: false });
  });

  it('says nothing inside a string or a comment', () => {
    expect(contextAt('ጻፍ("ሰላ', 6)).toBeNull();
    expect(contextAt('# ሰላ', 4)).toBeNull();
    // A `#` inside a string is not a comment.
    expect(contextAt('ጻፍ("#") ጻ', 9)?.prefix).toBe('ጻ');
  });

  it('says nothing in a number', () => {
    expect(contextAt('ሀ = 12', 6)).toBeNull();
  });

  it('knows a word after a dot is a member', () => {
    expect(contextAt('ዕድሜ.አግ', 6)).toMatchObject({ prefix: 'አግ', member: true });
  });

  it('knows whether the word starts or ends its line', () => {
    expect(contextAt('    ተግ', 6)).toMatchObject({ lineStart: true, lineEnd: true });
    expect(contextAt('ሀ > 1 ከ', 7)).toMatchObject({ lineStart: false, lineEnd: true });
  });
});

describe('matchQuality', () => {
  it('is exact for a plain prefix', () => {
    expect(matchQuality('ጻ', 'ጻፍ')).toBe(0);
  });

  it('matches the last syllable by its consonant, before the vowel is typed', () => {
    // An Amharic keyboard types ስ and then turns it into ሳ.
    expect(matchQuality('ደርድ', 'ደርድር')).toBe(0);
    expect(matchQuality('ጽ', 'ጻፍ')).toBe(1);
    expect(matchQuality('ጽሁ', 'ጽሁፍ_አድርግ')).toBe(0);
  });

  it('matches letters that sound alike', () => {
    expect(matchQuality('ፅሁፍ', 'ጽሁፍ')).toBe(1);
    expect(matchQuality('ሀሰ', 'ሐሰት')).toBe(1);
    expect(matchQuality('ኣለ', 'አለበለዚያ')).toBe(1);
  });

  it('does not match a different consonant', () => {
    expect(matchQuality('ጀ', 'ጻፍ')).toBeNull();
    expect(matchQuality('ጻፍፍ', 'ጻፍ')).toBeNull();
  });
});

describe('complete', () => {
  it('offers the built-ins', () => {
    expect(labels('ጻ|')).toContain('ጻፍ');
    expect(labels('ርዝ|')).toEqual(['ርዝመት']);
  });

  it('puts shorter names first among equal matches', () => {
    const found = labels('ጻ|');
    expect(found.indexOf('ጻፍ')).toBeLessThan(found.indexOf('ጽሁፍ_አድርግ'));
  });

  it('offers the program’s own names', () => {
    const source = 'ቆጣሪ = 0\nቆጣ|';
    expect(labels(source)[0]).toBe('ቆጣሪ');
  });

  it('does not offer the word being typed back to itself', () => {
    expect(labels('ቆጣሪ|')).not.toContain('ቆጣሪ');
  });

  it('offers a function the program defines, with its parameters', () => {
    const caret = 'ተግባር ሰላም_በል(ስም)፦\n    ጻፍ(ስም)\nሰላ'.length;
    const found = complete('ተግባር ሰላም_በል(ስም)፦\n    ጻፍ(ስም)\nሰላ', caret, am);
    expect(found?.items[0]).toMatchObject({
      label: 'ሰላም_በል',
      kind: 'function',
      detail: 'ሰላም_በል(ስም)',
    });
  });

  it('offers parameters only inside their function', () => {
    const inside = labels('ተግባር ትልቁ(ሀለ፣ ለ)፦\n    ተመላሽ ሀ|');
    expect(inside).toContain('ሀለ');
  });

  it('offers a class’s members after a dot', () => {
    const source = 'ክላስ ተማሪ፦\n    ስም = ""\n    ተግባር ደረጃ()፦\n        ተመላሽ 1\nአበበ = ተማሪ()\nአበበ.|';
    expect(labels(source, { language: 'am', explicit: true })).toEqual(
      expect.arrayContaining(['ስም', 'ደረጃ']),
    );
  });

  it('puts the program’s own members before the library’s', () => {
    const source = 'ክላስ ተማሪ፦\n    ስም = ""\n    ተግባር ደረጃ()፦\n        ተመላሽ 1\nአበበ = ተማሪ()\nአበበ.|';
    expect(labels(source).slice(0, 2)).toEqual(['ስም', 'ደረጃ']);
  });

  it('offers the methods of the library’s መዝገብ after a dot', () => {
    expect(labels('ዕ = መዝገብ()\nዕ.አ|')).toEqual(
      expect.arrayContaining(['አስገባ', 'አግኝ', 'አለው', 'አውጣ']),
    );
  });

  it('finds a built-in by its English idea', () => {
    const caret = 'print'.length;
    const found = complete('print', caret, am);
    expect(found?.items[0]).toMatchObject({ label: 'ጻፍ', via: 'print' });
    expect(labels('sor|')).toContain('ደርድር');
    expect(labels('if|')).toContain('ከሆነ');
  });

  it('does not consult English for one letter', () => {
    expect(labels('p|')).toEqual([]);
  });

  it('offers nothing for an empty word unless asked', () => {
    expect(complete('', 0, am)).toBeNull();
    expect(complete('', 0, { language: 'am', explicit: true })?.items.length).toBeGreaterThan(0);
  });

  it('never offers a reserved word', () => {
    expect(labels('አቁ|')).not.toContain('አቁም');
  });

  it('offers the variant spelling being typed', () => {
    expect(labels('ሐሰ|')).toContain('ሐሰት');
  });

  it('prefers keywords that start a line at the start of one', () => {
    const found = labels('ተ|');
    expect(found.indexOf('ተግባር')).toBeLessThan(found.indexOf('ተቃርኖ'));
  });

  it('describes things in the page’s language', () => {
    const doc = (language: 'am' | 'en'): string | undefined =>
      complete('ጻፍ', 1, { language })?.items.find((i) => i.label === 'ጻፍ')?.doc;
    expect(doc('en')).toMatch(/Prints/);
    expect(doc('am')).not.toMatch(/Prints/);
  });
});

describe('complete — whether the word is already finished', () => {
  const finished = (marked: string): boolean | undefined => {
    const caret = marked.indexOf('|');
    return complete(marked.replace('|', ''), caret, am)?.complete;
  };

  it('is finished when the word is a whole name with longer ones beside it', () => {
    expect(finished('ድምር = 1\nድምር_አጠቃላይ = 2\nድምር|')).toBe(true);
  });

  it('is finished when the word is a whole keyword', () => {
    expect(finished('ሀ > 1 ከ|')).toBe(false);
    expect(finished('አለበለዚያ|')).toBe(true);
  });

  it('is not finished part way through a name, or for an English word', () => {
    expect(finished('ድምር_አጠቃላይ = 2\nድም|')).toBe(false);
    expect(finished('print|')).toBe(false);
  });
});

describe('apply', () => {
  it('puts the caret inside a call’s parentheses', () => {
    expect(accept('ጻ|', 'ጻፍ')).toBe('ጻፍ(|)');
  });

  it('puts the caret after a call that takes nothing', () => {
    expect(accept('ዛ|', 'ዛሬ')).toBe('ዛሬ()|');
  });

  it('does not add parentheses that are already there', () => {
    expect(accept('ጻ|("ሀ")', 'ጻፍ')).toBe('ጻፍ|("ሀ")');
  });

  it('closes a block-opening keyword with ፦ at the end of a line', () => {
    expect(accept('ሀ > 1 ከ|', 'ከሆነ')).toBe('ሀ > 1 ከሆነ፦|');
    expect(accept('ሀ < 3 እስ|', 'እስከሆነ')).toBe('ሀ < 3 እስከሆነ ድረስ፦|');
    expect(accept('አለ|', 'አለበለዚያ')).toBe('አለበለዚያ፦|');
    expect(accept('ግ|', 'ግን')).toBe('ግን | ከሆነ፦');
  });

  it('leaves the rest of a line alone', () => {
    expect(accept('ሀ > 1 ከ| ', 'ከሆነ')).toBe('ሀ > 1 ከሆነ፦| ');
    expect(accept('ሀ > 1 ከ|፦', 'ከሆነ')).toBe('ሀ > 1 ከሆነ|፦');
  });

  it('replaces an English word with the Ge’ez name', () => {
    expect(accept('print|', 'ጻፍ')).toBe('ጻፍ(|)');
  });
});
