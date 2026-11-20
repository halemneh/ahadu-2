/**
 * The site's chrome, in both languages (SITE.md §3).
 *
 * Amharic is the default and English is complete, not a courtesy. The two
 * catalogues are checked against each other by a test, so a key added to one
 * and forgotten in the other is a failure rather than a blank corner of a
 * page.
 *
 * Only the site's own furniture lives here. Lesson prose is in `content/`,
 * and the interpreter's own messages are Amharic in both languages: they are
 * the language itself (LANGUAGE.md §9), not page text.
 */

export type Language = 'am' | 'en';

export interface Strings {
  readonly code: Language;
  readonly dir: string;
  readonly siteName: string;
  readonly tagline: string;

  // Navigation. `path` is the segment this language uses in URLs.
  readonly navHome: string;
  readonly navLearn: string;
  readonly navReference: string;
  readonly navExamples: string;
  readonly navPlayground: string;

  readonly pathLearn: string;
  readonly pathReference: string;
  readonly pathExamples: string;

  readonly languageToggle: string;
  readonly themeToggle: string;

  // Snippets
  readonly run: string;
  readonly running: string;
  readonly openInPlayground: string;
  readonly snippetLabel: string;
  readonly snippetVerified: string;
  readonly snippetFails: string;
  readonly noOutput: string;

  // Lessons
  readonly lessonsTitle: string;
  readonly next: string;
  readonly previous: string;
  readonly onThisPage: string;
  readonly exercise: string;
  readonly showAnswer: string;
  readonly hideAnswer: string;

  readonly referenceTitle: string;
  readonly examplesTitle: string;
  readonly openExample: string;
  readonly footer: string;
}

const am: Strings = {
  code: 'am',
  dir: 'ltr',
  siteName: 'አሃዱ',
  tagline: 'በአማርኛ የሚጻፍ የፕሮግራም ቋንቋ',

  navHome: 'መነሻ',
  navLearn: 'ተማር',
  navReference: 'ማጣቀሻ',
  navExamples: 'ምሳሌዎች',
  navPlayground: 'ሜዳ',

  pathLearn: 'ተማር',
  pathReference: 'ማጣቀሻ',
  pathExamples: 'ምሳሌዎች',

  languageToggle: 'English',
  themeToggle: 'ብርሃን ቀይር',

  run: '▸ አሂድ',
  running: 'በመሄድ ላይ…',
  openInPlayground: 'በሜዳ ክፈት',
  snippetLabel: 'የአሃዱ ኮድ',
  snippetVerified: 'ይህ ውጤት በግንባታ ጊዜ ተረጋግጧል',
  snippetFails: 'ይህ ፕሮግራም ሆን ተብሎ ስተት አለው',
  noOutput: 'ምንም አልተጻፈም',

  lessonsTitle: 'ትምህርቶች',
  next: 'ቀጣይ',
  previous: 'ቀዳሚ',
  onThisPage: 'በዚህ ገጽ',
  exercise: 'መልመጃ',
  showAnswer: 'መልሱን አሳይ',
  hideAnswer: 'መልሱን ደብቅ',

  referenceTitle: 'የቋንቋው ማጣቀሻ',
  examplesTitle: 'ምሳሌ ፕሮግራሞች',
  openExample: 'በሜዳ ክፈት',
  footer: 'አሃዱ ነጻ እና ክፍት ምንጭ ነው።',
};

const en: Strings = {
  code: 'en',
  dir: 'ltr',
  siteName: 'Ahadu',
  tagline: 'A programming language written in Amharic',

  navHome: 'Home',
  navLearn: 'Learn',
  navReference: 'Reference',
  navExamples: 'Examples',
  navPlayground: 'Playground',

  pathLearn: 'learn',
  pathReference: 'reference',
  pathExamples: 'examples',

  languageToggle: 'አማርኛ',
  themeToggle: 'Toggle theme',

  run: '▸ Run',
  running: 'Running…',
  openInPlayground: 'Open in playground',
  snippetLabel: 'Ahadu code',
  snippetVerified: 'This output was verified at build time',
  snippetFails: 'This program fails on purpose',
  noOutput: 'nothing was printed',

  lessonsTitle: 'Lessons',
  next: 'Next',
  previous: 'Previous',
  onThisPage: 'On this page',
  exercise: 'Exercise',
  showAnswer: 'Show the answer',
  hideAnswer: 'Hide the answer',

  referenceTitle: 'Language reference',
  examplesTitle: 'Example programs',
  openExample: 'Open in the playground',
  footer: 'Ahadu is free and open source.',
};

export const LANGUAGES: Record<Language, Strings> = { am, en };

export function strings(language: Language): Strings {
  return LANGUAGES[language];
}

export function otherLanguage(language: Language): Language {
  return language === 'am' ? 'en' : 'am';
}
