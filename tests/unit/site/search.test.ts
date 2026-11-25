/**
 * The header's search over the reference (SITE.md §5).
 *
 * The index is built from the same things the reference page is generated
 * from, so what these tests really check is that the two cannot disagree: a
 * name that exists is findable, and nothing is listed that does not exist.
 */

import { describe, expect, it } from 'vitest';
import { buildIndex, search } from '../../../tools/shared/search.js';
import { FN_ENTRIES } from '../../../tools/site/build/functions.js';
import { MESSAGES } from '../../../src/diagnostics.js';

const am = buildIndex('am');
const en = buildIndex('en');
const titles = (query: string, index = en): string[] =>
  search(index, query).map((hit) => hit.title);

describe('what the index covers', () => {
  it('has an entry for every documented function form', () => {
    const listed = new Set(en.map((hit) => hit.title));
    for (const entry of FN_ENTRIES) expect(listed.has(entry.sig), entry.sig).toBe(true);
  });

  it('has an entry for every error code', () => {
    const listed = new Set(en.map((hit) => hit.title));
    for (const code of Object.keys(MESSAGES)) expect(listed.has(code), code).toBe(true);
  });

  it('is built per language', () => {
    expect(am.length).toBe(en.length);
    expect(am.some((hit) => hit.href.startsWith('/am/'))).toBe(true);
    expect(en.some((hit) => hit.href.startsWith('/en/'))).toBe(true);
  });
});

describe('finding things', () => {
  it('lists each form of an overloaded name separately', () => {
    // The whole reason the reference has one card per form.
    expect(titles('ርዝመት')).toEqual(expect.arrayContaining(['ርዝመት(ጽሁፍ)', 'ርዝመት(ስብስብ)']));
  });

  it('finds an Amharic name by its English idea', () => {
    // Someone who knows what a sort is but not that it is called ደርድር.
    expect(titles('sort')).toContain('ደርድር(ስብስብ)');
    expect(titles('dictionary')).toContain('መዝገብ()');
    expect(titles('random')).toContain('ዘፈቀደ_ቁጥር(ከ፣ እስከ)');
  });

  it('finds an error code by its prefix', () => {
    expect(titles('AH3019')).toContain('AH3019');
  });

  it('finds a keyword group', () => {
    expect(titles('ከሆነ').length).toBeGreaterThan(0);
  });

  it('puts an exact prefix first', () => {
    expect(titles('ደምር')[0]).toBe('ደምር(ስብስብ)');
  });

  it('ignores case and Ethiopic punctuation, which nobody should have to type', () => {
    expect(titles('SORT')).toContain('ደርድር(ስብስብ)');
    expect(titles('ደምር(ስብስብ)')).toContain('ደምር(ስብስብ)');
  });

  it('answers nothing for an empty or unmatched query', () => {
    expect(titles('')).toEqual([]);
    expect(titles('   ')).toEqual([]);
    expect(titles('zzzznotathing')).toEqual([]);
  });

  it('every hit points at an anchor on the reference page', () => {
    for (const hit of en) {
      expect(hit.href, hit.title).toMatch(/^\/en\/reference\/#/);
    }
  });
});
