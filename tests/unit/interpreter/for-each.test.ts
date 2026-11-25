/**
 * `ለእያንዳንዱ` (§7.4).
 *
 * The loop that made every other list program shorter. Before it, walking a
 * list needed a hand-rolled counter and `ርዝመት`, which is why every v1 example
 * hardcoded `< 5` (CHANGES C28).
 */

import { describe, expect, it } from 'vitest';
import { code, message, out } from '../../helpers/evaluate.js';

const lines = (...source: string[]): string => source.join('\n');

describe('walking a list', () => {
  it('visits every element in order', () => {
    expect(out(lines('["ሀ"፣ "ለ"፣ "ሐ"] ለእያንዳንዱ ፊደሉ፦', '    ጻፍ(ፊደሉ)'))).toEqual(['ሀ', 'ለ', 'ሐ']);
  });

  it('takes the collection from any expression, not just a name', () => {
    expect(out(lines('ሀ = [1]', 'ሀ + [2] ለእያንዳንዱ ቁ፦', '    ጻፍ(ቁ)'))).toEqual(['1', '2']);
  });

  it('walks a slice', () => {
    expect(out(lines('[1፣ 2፣ 3፣ 4][1:3] ለእያንዳንዱ ቁ፦', '    ጻፍ(ቁ)'))).toEqual(['2', '3']);
  });

  it('walks a nested list, handing out whole lists', () => {
    expect(out(lines('[[1፣ 2]፣ [3]] ለእያንዳንዱ ዝ፦', '    ጻፍ(ርዝመት(ዝ))'))).toEqual(['2', '1']);
  });

  it('runs the body zero times for an empty list', () => {
    expect(out(lines('[] ለእያንዳንዱ ዕቃ፦', '    ጻፍ("አይ")', 'ጻፍ("አለፈ")'))).toEqual(['አለፈ']);
  });

  it('nests', () => {
    const source = lines('[1፣ 2] ለእያንዳንዱ ሀ፦', '    ["ሀ"፣ "ለ"] ለእያንዳንዱ ለ፦', '        ጻፍ(ሀ፣ ለ)');
    expect(out(source)).toEqual(['1 ሀ', '1 ለ', '2 ሀ', '2 ለ']);
  });
});

describe('walking a ጽሁፍ (§4.3)', () => {
  it('yields code points as one-character strings', () => {
    expect(out(lines('"ሰላም" ለእያንዳንዱ ፊደሉ፦', '    ጻፍ(ፊደሉ)'))).toEqual(['ሰ', 'ላ', 'ም']);
  });

  it('each one is a ጽሁፍ of length 1', () => {
    const source = lines('"ሀለ" ለእያንዳንዱ ፊደሉ፦', '    ጻፍ(አይነት(ፊደሉ)፣ ርዝመት(ፊደሉ))');
    expect(out(source)).toEqual(['ጽሁፍ 1', 'ጽሁፍ 1']);
  });

  it('agrees with ርዝመት about how many there are (§8)', () => {
    // Both count code points, so a string of Ethiopic letters walks as many
    // times as ርዝመት reports — the breadth is deliberately the same.
    const source = lines(
      'ቃል = "አሃዱ"',
      'ቆጥር = 0',
      'ቃል ለእያንዳንዱ ፊደሉ፦',
      '    ቆጥር = ቆጥር + 1',
      'ጻፍ(ቆጥር == ርዝመት(ቃል))',
    );
    expect(out(source)).toEqual(['እውነት']);
  });

  it('runs the body zero times for an empty string', () => {
    expect(out(lines('"" ለእያንዳንዱ ፊደሉ፦', '    ጻፍ("አይ")', 'ጻፍ("አለፈ")'))).toEqual(['አለፈ']);
  });
});

describe('the loop variable lives in the enclosing scope (§5.3)', () => {
  it('survives the loop, holding the last element visited', () => {
    // A block introduces no scope anywhere in Ahadu, and making this one name
    // the exception would be a special case a learner has to be told about.
    expect(out(lines('[1፣ 2፣ 3] ለእያንዳንዱ ቁ፦', '    ሀ = ቁ', 'ጻፍ(ቁ)'))).toEqual(['3']);
  });

  it('leaves an untouched name undefined after an empty collection', () => {
    expect(code(lines('[] ለእያንዳንዱ ቁ፦', '    ጻፍ(ቁ)', 'ጻፍ(ቁ)'))).toBe('AH3001');
  });

  it('overwrites an existing variable of the same name', () => {
    expect(out(lines('ቁ = "በፊት"', '[1] ለእያንዳንዱ ቁ፦', '    ጻፍ(ቁ)', 'ጻፍ(ቁ)'))).toEqual(['1', '1']);
  });

  it('a variable assigned in the body also survives', () => {
    expect(out(lines('[1፣ 2] ለእያንዳንዱ ቁ፦', '    ድምር = ቁ', 'ጻፍ(ድምር)'))).toEqual(['2']);
  });

  it('accumulates into a variable declared before the loop', () => {
    const source = lines('ድምር = 0', '[1፣ 2፣ 3፣ 4] ለእያንዳንዱ ቁ፦', '    ድምር = ድምር + ቁ', 'ጻፍ(ድምር)');
    expect(out(source)).toEqual(['10']);
  });
});

describe('the iteration is a snapshot (§7.4)', () => {
  it('does not loop forever when the body appends', () => {
    // The whole reason for the rule: by-live-index, this never terminates.
    expect(out(lines('ዝ = [1፣ 2]', 'ዝ ለእያንዳንዱ ቁ፦', '    አዋህድ(ዝ፣ ቁ * 10)', 'ጻፍ(ዝ)'))).toEqual([
      '[1፣ 2፣ 10፣ 20]',
    ]);
  });

  it('does not skip an element when the body deletes', () => {
    // By-live-index, this visits 1 and 3 and silently loses 2.
    const source = lines(
      'ሁ = [1፣ 2፣ 3]',
      'ታይተዋል = []',
      'ሁ ለእያንዳንዱ ቁ፦',
      '    አዋህድ(ታይተዋል፣ ቁ)',
      '    ሰርዝ(ሁ፣ 0)',
      'ጻፍ(ታይተዋል)',
      'ጻፍ(ሁ)',
    );
    expect(out(source)).toEqual(['[1፣ 2፣ 3]', '[]']);
  });

  it('still shares the list itself, so an element may be replaced in place', () => {
    // Only the iteration is fixed; §4.5 sharing is untouched.
    expect(out(lines('ዝ = [1፣ 2]', 'ዝ ለእያንዳንዱ ቁ፦', '    ዝ[0] = 99', 'ጻፍ(ዝ)'))).toEqual(['[99፣ 2]']);
  });

  it('hands out the same list object, not a copy of each element', () => {
    const source = lines('ውስጥ = [1]', '[ውስጥ] ለእያንዳንዱ ዝ፦', '    አዋህድ(ዝ፣ 2)', 'ጻፍ(ውስጥ)');
    expect(out(source)).toEqual(['[1፣ 2]']);
  });
});

describe('what cannot be walked', () => {
  it('is AH3002 for every non-collection', () => {
    for (const expression of ['5', 'እውነት', 'ምንም', 'ጻፍ']) {
      expect(code(lines(`${expression} ለእያንዳንዱ ዕቃ፦`, '    ጻፍ(ዕቃ)')), expression).toBe('AH3002');
    }
  });

  it('names ለእያንዳንዱ and the type in the message', () => {
    const text = message(lines('5 ለእያንዳንዱ ዕቃ፦', '    ጻፍ(ዕቃ)'));
    expect(text).toContain('ለእያንዳንዱ');
    expect(text).toContain('ቁጥር');
  });

  it('points at the collection, not the body', () => {
    const result = code(lines('ሀ = 1', 'ሀ ለእያንዳንዱ ዕቃ፦', '    ጻፍ(ዕቃ)'));
    expect(result).toBe('AH3002');
  });
});

describe('parse errors (§7.4)', () => {
  it('rejects the keyword-first shape other languages use', () => {
    expect(code(lines('ለእያንዳንዱ ስም በቤተሰብ፦', '    ጻፍ(ስም)'))).toBe('AH2001');
  });

  it('says where the collection belongs', () => {
    expect(message(lines('ለእያንዳንዱ ስም፦', '    ጻፍ(ስም)'))).toContain('ለእያንዳንዱ');
  });

  it('reports a missing loop variable', () => {
    expect(code(lines('[1] ለእያንዳንዱ፦', '    ጻፍ(1)'))).toBe('AH2001');
  });

  it('still parses the body after a missing name, so one word does not cascade', () => {
    // §9.3: a block is parsed even when its header was wrong.
    const source = lines('[1] ለእያንዳንዱ፦', '    ያልተገለጸ +', 'ጻፍ(1)');
    expect(code(source)).toBe('AH2001');
  });

  it('rejects an empty body like any other block (AH2006)', () => {
    expect(code('[1] ለእያንዳንዱ ቁ፦\n')).toBe('AH2006');
  });
});

describe('the loop variable is an ordinary identifier', () => {
  it('cannot be a reserved word — ፊደል is held for a future char type (§3.2)', () => {
    // Worth pinning: ፊደል ("letter") is the word a learner reaches for when
    // walking a string, and it is reserved. The parse error has to be the one
    // that says so rather than something about the loop.
    expect(code(lines('"ሀ" ለእያንዳንዱ ፊደል፦', '    ጻፍ(ፊደል)'))).toBe('AH2001');
  });

  it('accepts a የ-prefixed name like any other identifier (§3.3)', () => {
    expect(out(lines('[1] ለእያንዳንዱ ቁጥሩ፦', '    ጻፍ(ቁጥሩ)'))).toEqual(['1']);
  });
});

describe('ለ is still free as a variable name (§3.2)', () => {
  it('because reserving one ubiquitous syllable would cost too much', () => {
    expect(out('ለ = 5\nጻፍ(ለ)')).toEqual(['5']);
  });
});
