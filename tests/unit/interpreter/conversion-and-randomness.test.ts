/**
 * The conversion and randomness built-ins (§8.2, §8.3).
 *
 * These exist because `አንብብ` returns `ጽሁፍ` and `+` refuses to mix a `ጽሁፍ`
 * with a `ቁጥር` (§6.2), so before them nothing a learner typed could be added
 * — a calculator was not a missing example but an unwritable program. The
 * first test here is that program.
 */

import { describe, expect, it } from 'vitest';
import { parseNumericText } from '../../../src/numeric.js';
import { code, message, out, shows } from '../../helpers/evaluate.js';

const lines = (...source: string[]): string => source.join('\n');

describe('the program this unblocked', () => {
  it('adds two numbers a person typed', () => {
    const source = lines('ሀ = ወደቁጥር(አንብብ("አንደኛው፦ "))', 'ለ = ወደቁጥር(አንብብ("ሁለተኛው፦ "))', 'ጻፍ(ሀ + ለ)');
    expect(out(source, { input: ['12', '30'] })).toEqual(['አንደኛው፦ ', 'ሁለተኛው፦ ', '42']);
  });

  it('was AH3002 without the conversion', () => {
    expect(code('ሀ = አንብብ()\nጻፍ(ሀ + 1)', { input: ['7'] })).toBe('AH3002');
  });
});

describe('ወደቁጥር (§8.2)', () => {
  it('reads a whole number and a decimal', () => {
    expect(shows('ወደቁጥር("7")')).toBe('7');
    expect(shows('ወደቁጥር("3.5")')).toBe('3.5');
  });

  it('reads a negative number', () => {
    expect(shows('ወደቁጥር("-12")')).toBe('-12');
    expect(shows('ወደቁጥር("-3.5")')).toBe('-3.5');
  });

  it('has one zero, so "-0" is 0', () => {
    expect(shows('ወደቁጥር("-0") == 0')).toBe('እውነት');
  });

  it('reads Ge’ez numerals, because the language writes them too (§3.4.1)', () => {
    // The point of sharing one rule with the lexer: a language that accepted
    // ፫፻፳፩ in a file and refused the same digits at a prompt would be lying
    // about its own numerals.
    expect(shows('ወደቁጥር("፫፻፳፩")')).toBe('321');
    expect(shows('ወደቁጥር("፪፼")')).toBe('20000');
  });

  it('ignores surrounding whitespace, which a prompt collects by accident', () => {
    expect(shows('ወደቁጥር("  7  ")')).toBe('7');
    expect(shows('ወደቁጥር("\\t7\\n")')).toBe('7');
  });

  it('returns a ቁጥር unchanged, so a program need not track what is converted', () => {
    expect(shows('ወደቁጥር(7)')).toBe('7');
    expect(shows('አይነት(ወደቁጥር(7))')).toBe('ቁጥር');
  });

  it('rejects what the lexer rejects: a dot needs digits on both sides (§3.4)', () => {
    expect(code('ጻፍ(ወደቁጥር("5."))')).toBe('AH3019');
    expect(code('ጻፍ(ወደቁጥር(".5"))')).toBe('AH3019');
    expect(code('ጻፍ(ወደቁጥር("1.2.3"))')).toBe('AH3019');
  });

  it('rejects notations the language has no literal for', () => {
    for (const text of ['1e3', '0x10', '+7', '١٢٣', '7፡', 'ሰላም']) {
      expect(code(`ጻፍ(ወደቁጥር("${text}"))`), text).toBe('AH3019');
    }
  });

  it('fails loudly rather than returning ምንም', () => {
    // A calculator that quietly computed with ምንም would print an answer and
    // the learner would believe it.
    expect(code('ጻፍ(ወደቁጥር("ሰላም"))')).toBe('AH3019');
  });

  it('quotes the offending text back, since the cause is usually invisible', () => {
    expect(message('ጻፍ(ወደቁጥር("7፡"))')).toContain('"7፡"');
  });

  it('says what happened when someone just pressed Enter', () => {
    // `"" ቁጥር አይደለም።` shows a beginner nothing at all.
    const text = message('ጻፍ(ወደቁጥር(አንብብ()))', { input: [''] });
    expect(text).toBe('ምንም አልተጻፈም፤ ቁጥር ያስፈልጋል።');
  });

  it('is AH3002 for a type it cannot read at all, like ርዝመት (§8)', () => {
    expect(code('ጻፍ(ወደቁጥር([1]))')).toBe('AH3002');
    expect(code('ጻፍ(ወደቁጥር(እውነት))')).toBe('AH3002');
  });

  it('takes exactly one argument', () => {
    expect(code('ጻፍ(ወደቁጥር())')).toBe('AH3010');
    expect(code('ጻፍ(ወደቁጥር("1"፣ "2"))')).toBe('AH3010');
  });
});

describe('ወደጽሁፍ (§8.1)', () => {
  it('gives exactly what ጻፍ would have printed', () => {
    expect(shows('ወደጽሁፍ(42)')).toBe('42');
    expect(shows('ወደጽሁፍ(እውነት)')).toBe('እውነት');
    expect(shows('ወደጽሁፍ(ምንም)')).toBe('ምንም');
    expect(shows('ወደጽሁፍ([1፣ 2])')).toBe('[1፣ 2]');
  });

  it('makes a number concatenable, which is why it exists', () => {
    expect(out('ጻፍ("ውጤት፦ " + ወደጽሁፍ(9))')).toEqual(['ውጤት፦ 9']);
  });

  it('leaves a ጽሁፍ alone', () => {
    expect(shows('ወደጽሁፍ("ሰላም")')).toBe('ሰላም');
  });

  it('round-trips with ወደቁጥር', () => {
    expect(shows('ወደቁጥር(ወደጽሁፍ(-3.5))')).toBe('-3.5');
  });

  it('takes exactly one argument', () => {
    expect(code('ጻፍ(ወደጽሁፍ())')).toBe('AH3010');
  });
});

describe('ቁጥርነው (§8.2)', () => {
  it('answers for text', () => {
    expect(shows('ቁጥርነው("12")')).toBe('እውነት');
    expect(shows('ቁጥርነው("ሰላም")')).toBe('ሃሰት');
    expect(shows('ቁጥርነው("")')).toBe('ሃሰት');
  });

  it('answers እውነት for a number, which already is one', () => {
    expect(shows('ቁጥርነው(5)')).toBe('እውነት');
  });

  it('never raises, for any value — a guard that can fail is no guard', () => {
    for (const expression of ['[1]', 'እውነት', 'ምንም', 'ጻፍ']) {
      expect(code(`ጻፍ(ቁጥርነው(${expression}))`), expression).toBe(null);
    }
  });

  it('agrees with ወደቁጥር on every value', () => {
    for (const text of ['7', '-3.5', '፫፻፳፩', ' 7 ', '5.', 'ሰላም', '', '1e3']) {
      const guard = shows(`ቁጥርነው("${text}")`) === 'እውነት';
      const converts = code(`ጻፍ(ወደቁጥር("${text}"))`) === null;
      expect(guard, text).toBe(converts);
    }
  });

  it('lets a program check before converting', () => {
    const source = lines(
      'ግቤት = አንብብ()',
      'ቁጥርነው(ግቤት) ከሆነ፦',
      '    ጻፍ(ወደቁጥር(ግቤት) * 2)',
      'አለበለዚያ፦',
      '    ጻፍ("ቁጥር አልጻፉም።")',
    );
    expect(out(source, { input: ['21'] })).toEqual(['42']);
    expect(out(source, { input: ['ሰላም'] })).toEqual(['ቁጥር አልጻፉም።']);
  });
});

describe('አጋጣሚ (§8.3)', () => {
  it('includes both ends, so አጋጣሚ(1፣ 6) is a die', () => {
    const faces = new Set<string>();
    for (let seed = 0; seed < 400; seed += 1) {
      faces.add(shows(`አጋጣሚ(1፣ 6)`));
      // A fresh default-seeded run each time would give one value, so vary it
      // through ዘር instead.
      faces.add(out(`ዘር(${seed})\nጻፍ(አጋጣሚ(1፣ 6))`)[0] as string);
    }
    expect([...faces].sort()).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('draws the only possible value from a single-value range', () => {
    expect(shows('አጋጣሚ(4፣ 4)')).toBe('4');
  });

  it('accepts negative bounds', () => {
    const drawn = Number(out('ዘር(3)\nጻፍ(አጋጣሚ(0 - 5፣ 0 - 1))')[0]);
    expect(drawn).toBeGreaterThanOrEqual(-5);
    expect(drawn).toBeLessThanOrEqual(-1);
  });

  it('is reproducible: the same seed gives the same sequence', () => {
    const roll = 'ጻፍ(አጋጣሚ(1፣ 1000)፣ አጋጣሚ(1፣ 1000)፣ አጋጣሚ(1፣ 1000))';
    expect(out(`ዘር(99)\n${roll}`)).toEqual(out(`ዘር(99)\n${roll}`));
  });

  it('gives different sequences for different seeds', () => {
    const roll = 'ጻፍ(አጋጣሚ(1፣ 1000000))';
    expect(
      out(`ዘር(1)
${roll}`),
    ).not.toEqual(
      out(`ዘር(2)
${roll}`),
    );
  });

  it('starts from a fixed seed when the host names none, so a run repeats', () => {
    // The direction that keeps the site's build-time snippet check honest
    // (SITE.md §2): a host that forgets the option gets a verifiable program.
    const roll = 'ጻፍ(አጋጣሚ(1፣ 1000000))';
    expect(out(roll)).toEqual(out(roll));
  });

  it('honours a seed the host supplies', () => {
    const roll = 'ጻፍ(አጋጣሚ(1፣ 1000000))';
    expect(out(roll, { seed: 5 })).toEqual(out('ዘር(5)\n' + roll));
    expect(out(roll, { seed: 5 })).not.toEqual(out(roll, { seed: 6 }));
  });

  it('rejects bounds in the wrong order', () => {
    expect(code('ጻፍ(አጋጣሚ(6፣ 1))')).toBe('AH3020');
  });

  it('rejects fractional bounds', () => {
    expect(code('ጻፍ(አጋጣሚ(1.5፣ 6))')).toBe('AH3020');
    expect(code('ጻፍ(አጋጣሚ(1፣ 6.5))')).toBe('AH3020');
  });

  it('names both bounds in the message, so the mistake is visible', () => {
    expect(message('ጻፍ(አጋጣሚ(6፣ 1))')).toContain('6');
    expect(message('ጻፍ(አጋጣሚ(6፣ 1))')).toContain('1');
  });

  it('is AH3002 for a type that is not a number', () => {
    expect(code('ጻፍ(አጋጣሚ("ሀ"፣ 6))')).toBe('AH3002');
  });

  it('takes exactly two arguments, since a die needs both ends', () => {
    expect(code('ጻፍ(አጋጣሚ())')).toBe('AH3010');
    expect(code('ጻፍ(አጋጣሚ(6))')).toBe('AH3010');
  });
});

describe('ዘር (§8.3)', () => {
  it('returns ምንም, like the other imperatives (§4.5)', () => {
    // So `ሀ = ዘር(5)` fails loudly instead of looking useful.
    expect(out('ሀ = ዘር(5)\nጻፍ(ሀ)')).toEqual(['ምንም']);
  });

  it('restarts the sequence mid-program', () => {
    const source = lines(
      'ዘር(7)',
      'ሀ = አጋጣሚ(1፣ 1000)',
      'ለ = አጋጣሚ(1፣ 1000)',
      'ዘር(7)',
      'ሐ = አጋጣሚ(1፣ 1000)',
      'ጻፍ(ሀ == ሐ)',
      'ጻፍ(ሀ == ለ)',
    );
    expect(out(source)).toEqual(['እውነት', 'ሃሰት']);
  });

  it('accepts a Ge’ez numeral seed, like any other ቁጥር', () => {
    expect(out('ዘር(፩)\nጻፍ(አጋጣሚ(1፣ 1000))')).toEqual(out('ዘር(1)\nጻፍ(አጋጣሚ(1፣ 1000))'));
  });

  it('accepts a fractional or negative seed rather than rejecting it', () => {
    // Every number someone might choose is usable; two seeds may collide.
    expect(code('ዘር(0 - 4.5)\nጻፍ(አጋጣሚ(1፣ 6))')).toBe(null);
  });

  it('is AH3002 for a seed that is not a number', () => {
    expect(code('ዘር("ሀ")')).toBe('AH3002');
  });

  it('takes exactly one argument', () => {
    expect(code('ዘር()')).toBe('AH3010');
  });
});

describe('parseNumericText, the one rule both readers use', () => {
  it('accepts what the lexer accepts', () => {
    expect(parseNumericText('7')).toBe(7);
    expect(parseNumericText('3.5')).toBe(3.5);
    expect(parseNumericText('-3.5')).toBe(-3.5);
    expect(parseNumericText('፫፻፳፩')).toBe(321);
    expect(parseNumericText('  7  ')).toBe(7);
  });

  it('returns null rather than throwing, so each caller decides what it means', () => {
    // ወደቁጥር raises AH3019; ቁጥርነው answers ሃሰት.
    expect(parseNumericText('ሰላም')).toBe(null);
    expect(parseNumericText('')).toBe(null);
    expect(parseNumericText('-')).toBe(null);
    expect(parseNumericText('5.')).toBe(null);
  });

  it('rejects a malformed Ge’ez run the way the lexer does (AH1005)', () => {
    // ፩፪ is two units symbols in a row.
    expect(parseNumericText('፩፪')).toBe(null);
    expect(parseNumericText('፩፳')).toBe(null);
  });

  it('does not accept a mixed run', () => {
    expect(parseNumericText('1፩')).toBe(null);
    expect(parseNumericText('፩1')).toBe(null);
  });
});
