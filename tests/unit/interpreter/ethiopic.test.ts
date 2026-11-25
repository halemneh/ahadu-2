/**
 * The Ethiopian calendar (§8.8) and Ge'ez numerals out (§8.7).
 *
 * The conversion is checked two ways: against dates whose answer is known
 * independently, and by round-tripping every day across several centuries.
 * Anchors alone would not catch a formula that drifts by a day for a quarter
 * of all dates, and a round-trip alone would not catch one that is
 * self-consistently wrong.
 */

import { describe, expect, it } from 'vitest';
import {
  ETHIOPIC_MONTHS,
  ethiopicMonthLength,
  ethiopicToJdn,
  gregorianToEthiopic,
  gregorianToJdn,
  isEthiopicLeapYear,
  isRealGregorianDate,
  jdnToEthiopic,
  jdnToGregorian,
} from '../../../src/ethiopic.js';
import { MAX_GEEZ, parseNumericText, writeGeezNumeral } from '../../../src/numeric.js';
import { code, message, out } from '../../helpers/evaluate.js';

describe('Gregorian to Ethiopian, against known dates', () => {
  // Ethiopian New Year is 11 September — or the 12th when the February that
  // follows has 29 days. Getting only one of those right is the usual bug.
  const anchors: readonly {
    readonly gregorian: readonly [number, number, number];
    readonly ethiopic: readonly [number, number, number];
    readonly why: string;
  }[] = [
    { gregorian: [2024, 9, 11], ethiopic: [2017, 1, 1], why: 'next February is not a leap' },
    { gregorian: [2023, 9, 12], ethiopic: [2016, 1, 1], why: 'next February is a leap' },
    { gregorian: [2019, 9, 12], ethiopic: [2012, 1, 1], why: 'next February is a leap' },
    { gregorian: [2025, 9, 11], ethiopic: [2018, 1, 1], why: 'next February is not a leap' },
    { gregorian: [2024, 1, 1], ethiopic: [2016, 4, 22], why: 'mid-year' },
  ];

  it.each(anchors)('$gregorian → $ethiopic ($why)', ({ gregorian, ethiopic }) => {
    const got = gregorianToEthiopic({
      year: gregorian[0],
      month: gregorian[1],
      day: gregorian[2],
    });
    expect([got.year, got.month, got.day]).toEqual([...ethiopic]);
  });
});

describe('the conversion is exact over centuries', () => {
  it('round-trips every day from JDN 2,200,000 to 2,350,000', () => {
    let failures = 0;
    for (let jdn = 2_200_000; jdn < 2_350_000; jdn += 1) {
      if (ethiopicToJdn(jdnToEthiopic(jdn)) !== jdn) failures += 1;
    }
    expect(failures).toBe(0);
  });

  it('never produces a month or day outside its own calendar', () => {
    const bad: number[] = [];
    for (let jdn = 2_200_000; jdn < 2_350_000; jdn += 1) {
      const d = jdnToEthiopic(jdn);
      if (
        d.month < 1 ||
        d.month > 13 ||
        d.day < 1 ||
        d.day > ethiopicMonthLength(d.year, d.month)
      ) {
        bad.push(jdn);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('thirteen months, the last one short', () => {
  it('names all thirteen', () => {
    expect(ETHIOPIC_MONTHS).toHaveLength(13);
    expect(ETHIOPIC_MONTHS[0]).toBe('መስከረም');
    expect(ETHIOPIC_MONTHS[12]).toBe('ጳጉሜ');
  });

  it('gives the first twelve thirty days each', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(ethiopicMonthLength(2016, month), String(month)).toBe(30);
    }
  });

  it('gives ጳጉሜ six days when ዓመት % 4 == 3, and five otherwise', () => {
    for (const year of [2011, 2015, 2019]) {
      expect(isEthiopicLeapYear(year), String(year)).toBe(true);
      expect(ethiopicMonthLength(year, 13)).toBe(6);
    }
    for (const year of [2016, 2017, 2018]) {
      expect(isEthiopicLeapYear(year), String(year)).toBe(false);
      expect(ethiopicMonthLength(year, 13)).toBe(5);
    }
  });

  it('agrees that a leap year has 366 days', () => {
    const start = ethiopicToJdn({ year: 2015, month: 1, day: 1 });
    const next = ethiopicToJdn({ year: 2016, month: 1, day: 1 });
    expect(next - start).toBe(366);
    expect(
      ethiopicToJdn({ year: 2017, month: 1, day: 1 }) -
        ethiopicToJdn({ year: 2016, month: 1, day: 1 }),
    ).toBe(365);
  });
});

describe('the built-ins (§8.8)', () => {
  it('ከግሪጎሪ hands back three numbers', () => {
    expect(out('ጻፍ(ከግሪጎሪ(2024፣ 9፣ 11))')).toEqual(['[2017፣ 1፣ 1]']);
  });

  it('ዛሬ reads the instant the host supplied, in UTC', () => {
    // A local reading would make the same program print different dates on
    // two machines, and a snippet's output could not be checked at all.
    expect(out('ጻፍ(ዛሬ())', { now: Date.UTC(2024, 8, 11) })).toEqual(['[2017፣ 1፣ 1]']);
  });

  it('ዛሬ is fixed when no host supplies an instant, so a program repeats', () => {
    expect(out('ጻፍ(ዛሬ())')).toEqual(out('ጻፍ(ዛሬ())'));
  });

  it('ወርስም names each month', () => {
    expect(out('ጻፍ(ወርስም(1)፣ ወርስም(3)፣ ወርስም(13))')).toEqual(['መስከረም ኅዳር ጳጉሜ']);
  });

  it('ወርስም rejects a month that does not exist', () => {
    for (const month of ['0', '14', '1.5']) {
      expect(code(`ጻፍ(ወርስም(${month}))`), month).toBe('AH3022');
    }
  });

  it('says how many months the year has, which is the surprising part', () => {
    expect(message('ጻፍ(ወርስም(14))')).toContain('13');
  });

  it('ከግሪጎሪ refuses a date that does not exist', () => {
    // Validated by converting and converting back: a formula that quietly
    // accepts 31 February returns a date, just not the one it was asked for.
    for (const date of ['2024፣ 2፣ 31', '2024፣ 13፣ 1', '2024፣ 0፣ 1', '2024፣ 1፣ 32']) {
      expect(code(`ጻፍ(ከግሪጎሪ(${date}))`), date).toBe('AH3022');
    }
  });

  it('is a plain ስብስብ, so everything that works on a list works on a date', () => {
    const source = 'ቀኑ = ከግሪጎሪ(2024፣ 9፣ 11)\nጻፍ(ርዝመት(ቀኑ)፣ አይነት(ቀኑ)፣ ቀኑ[-1])';
    expect(out(source)).toEqual(['3 ስብስብ 1']);
  });
});

describe('the Gregorian round-trip, which is what validates a date', () => {
  it('rejects 31 February, which the forward formula accepts', () => {
    // The formula gives 31 February a day number, and it is a real day —
    // 2 March. Only converting back catches it.
    expect(gregorianToJdn({ year: 2024, month: 2, day: 31 })).toBeGreaterThan(0);
    expect(isRealGregorianDate({ year: 2024, month: 2, day: 31 })).toBe(false);
    expect(jdnToGregorian(gregorianToJdn({ year: 2024, month: 2, day: 31 }))).toEqual({
      year: 2024,
      month: 3,
      day: 2,
    });
  });

  it('accepts 29 February in a leap year and refuses it otherwise', () => {
    expect(isRealGregorianDate({ year: 2024, month: 2, day: 29 })).toBe(true);
    expect(isRealGregorianDate({ year: 2023, month: 2, day: 29 })).toBe(false);
    // The century rule, which a naive check gets wrong.
    expect(isRealGregorianDate({ year: 2000, month: 2, day: 29 })).toBe(true);
    expect(isRealGregorianDate({ year: 1900, month: 2, day: 29 })).toBe(false);
  });

  it('round-trips every day across the same range', () => {
    let failures = 0;
    for (let jdn = 2_200_000; jdn < 2_350_000; jdn += 1) {
      if (gregorianToJdn(jdnToGregorian(jdn)) !== jdn) failures += 1;
    }
    expect(failures).toBe(0);
  });
});

describe('Ge’ez numerals out (§8.7)', () => {
  it('writes what §3.4.1 reads, for every spellable value in a wide range', () => {
    let failures = 0;
    for (let n = 1; n <= 200_000; n += 1) {
      const written = writeGeezNumeral(n);
      if (written === null || parseNumericText(written) !== n) failures += 1;
    }
    expect(failures).toBe(0);
  });

  it('leaves out a leading 1 before a separator, as the numerals are written', () => {
    // §3.4.1 reads an empty group before a separator as 1, so a hundred is ፻.
    expect(writeGeezNumeral(100)).toBe('፻');
    expect(writeGeezNumeral(10_000)).toBe('፼');
    expect(writeGeezNumeral(321)).toBe('፫፻፳፩');
  });

  it('has no spelling for zero, negatives or fractions', () => {
    for (const n of [0, -1, 3.5, MAX_GEEZ + 1]) {
      expect(writeGeezNumeral(n), String(n)).toBe(null);
    }
  });

  it('says why zero has none, because that is worth learning', () => {
    // The system is additive, built from symbols that each carry a value,
    // with nothing standing for none.
    const text = message('ጻፍ(ወደግዕዝ(0))');
    expect(text).toContain('ዜሮ');
    expect(text).toContain('፩');
  });

  it('round-trips through the language itself', () => {
    expect(out('ጻፍ(ወደቁጥር(ወደግዕዝ(4567)) == 4567)')).toEqual(['እውነት']);
  });

  it('is AH3021 for a number with no spelling', () => {
    expect(code('ጻፍ(ወደግዕዝ(0))')).toBe('AH3021');
  });
});
