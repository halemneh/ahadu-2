/**
 * The Ethiopian calendar (LANGUAGE.md §8.8).
 *
 * Thirteen months: twelve of thirty days, then ጳጉሜ of five, or six in a leap
 * year. The year begins on መስከረም 1, which falls on 11 September in the
 * Gregorian calendar — or 12 September when the February that follows has 29
 * days. An Ethiopian year runs seven or eight behind the Gregorian one,
 * depending on which side of መስከረም 1 a date sits.
 *
 * Both directions go through the **Julian Day Number**, a plain count of days
 * that neither calendar owns. Converting through it means each calendar is
 * described once, by itself, and there is no month-by-month correspondence
 * table to get wrong. A test round-trips every day across several centuries.
 *
 * Pure arithmetic with no `node:` imports, so it runs in the browser exactly
 * as it does in the CLI (TOOLING.md §2.3).
 */

/** JDN of መስከረም 1, year 1 — 29 August 8 AD in the Julian calendar. */
const ETHIOPIC_EPOCH_JDN = 1_724_221;

/** Days in four Ethiopian years: three of 365 and one of 366. */
const FOUR_YEARS = 1461;

/**
 * Days elapsed before each year of a four-year block.
 *
 * Not `365 * i`, because the long year is the **third** of the block: an
 * Ethiopian year is a leap year when `year % 4 === 3`, so ጳጉሜ has six days in
 * years 3, 7, 11 and so on. Getting this to `[0, 365, 730, 1095]` is the
 * off-by-one that makes a conversion drift by a day for a quarter of all
 * dates, which is exactly the kind of error that survives a spot check.
 */
const YEAR_STARTS = [0, 365, 730, 1096] as const;

/** The thirteen month names, in order. */
export const ETHIOPIC_MONTHS: readonly string[] = [
  'መስከረም',
  'ጥቅምት',
  'ኅዳር',
  'ታኅሣሥ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ',
];

/** A date in either calendar: year, month 1–13, day 1–30. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Whether ጳጉሜ has six days in this Ethiopian year. */
export function isEthiopicLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
}

/** Days in an Ethiopian month: thirty, except ጳጉሜ. */
export function ethiopicMonthLength(year: number, month: number): number {
  if (month !== 13) return 30;
  return isEthiopicLeapYear(year) ? 6 : 5;
}

/** The Julian Day Number of an Ethiopian date. */
export function ethiopicToJdn({ year, month, day }: CalendarDate): number {
  // `floor(year / 4)` and not `floor((year - 1) / 4)`: the leap years at or
  // before `year - 1` are those divisible-by-4-with-remainder-3, and there are
  // `floor(year / 4)` of them.
  return ETHIOPIC_EPOCH_JDN - 1 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day;
}

/** The Ethiopian date of a Julian Day Number. */
export function jdnToEthiopic(jdn: number): CalendarDate {
  const elapsed = jdn - ETHIOPIC_EPOCH_JDN;
  const blocks = Math.floor(elapsed / FOUR_YEARS);
  const within = elapsed - blocks * FOUR_YEARS;

  let index = 3;
  for (let i = 0; i < 4; i += 1) {
    const next = YEAR_STARTS[i + 1];
    if (next === undefined || within < next) {
      index = i;
      break;
    }
  }

  const dayOfYear = within - (YEAR_STARTS[index] as number);
  return {
    year: blocks * 4 + index + 1,
    month: Math.floor(dayOfYear / 30) + 1,
    day: (dayOfYear % 30) + 1,
  };
}

/** The Julian Day Number of a Gregorian date, by the standard civil formula. */
export function gregorianToJdn({ year, month, day }: CalendarDate): number {
  const shift = Math.floor((14 - month) / 12);
  const y = year + 4800 - shift;
  const m = month + 12 * shift - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32_045
  );
}

/** The Ethiopian date for a Gregorian one. */
export function gregorianToEthiopic(date: CalendarDate): CalendarDate {
  return jdnToEthiopic(gregorianToJdn(date));
}

/**
 * The Ethiopian date for a moment in Unix milliseconds.
 *
 * Read in **UTC**, deliberately. A host's local time zone would make the same
 * program print different dates on two machines, and the website runs every
 * snippet at build time and checks its output (SITE.md §2) — so a date that
 * depended on where the build ran could not be verified at all.
 */
export function ethiopicFromUnixMillis(millis: number): CalendarDate {
  const days = Math.floor(millis / 86_400_000);
  // JDN 2440588 is 1 January 1970.
  return jdnToEthiopic(2_440_588 + days);
}

/**
 * The Gregorian date of a Julian Day Number — the inverse of
 * `gregorianToJdn`.
 *
 * Needed to tell whether a Gregorian date someone typed exists at all.
 * `gregorianToJdn` is a formula, not a validator: it computes a day number
 * for 31 February perfectly happily, and that number is a real day — 2 or 3
 * March. So the only honest check is to convert and convert **back**, and
 * compare. Converting to the Ethiopian calendar and finding a valid date
 * there proves nothing, because every day number is a valid Ethiopian date.
 */
export function jdnToGregorian(jdn: number): CalendarDate {
  const a = jdn + 32_044;
  const b = Math.floor((4 * a + 3) / 146_097);
  const c = a - Math.floor((146_097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    year: 100 * b + d - 4800 + Math.floor(m / 10),
    month: m + 3 - 12 * Math.floor(m / 10),
    day: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

/** Whether a Gregorian date exists, checked by converting and converting back. */
export function isRealGregorianDate(date: CalendarDate): boolean {
  if (![date.year, date.month, date.day].every((n) => Number.isInteger(n))) return false;
  const back = jdnToGregorian(gregorianToJdn(date));
  return back.year === date.year && back.month === date.month && back.day === date.day;
}
