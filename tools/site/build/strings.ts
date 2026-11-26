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

  /*
   * The names of the page's landmarks, and of the control that opens the
   * navigation on a narrow screen.
   *
   * A page carries four `nav` elements — the sections, the lesson list, the
   * contents of this page, and the step to the next lesson — and a screen
   * reader offers them as a list of landmarks to jump between. Four entries
   * all called "navigation" is a list that says nothing.
   */
  readonly navLabel: string;
  readonly navMenu: string;
  readonly navSteps: string;
  readonly skipToContent: string;

  readonly languageToggle: string;
  /** The header search box. */
  readonly findLabel: string;
  readonly themeToggle: string;

  // Snippets
  readonly run: string;
  readonly running: string;
  readonly openInPlayground: string;
  readonly snippetLabel: string;
  readonly snippetVerified: string;
  readonly snippetFails: string;
  /** Under a `varies` snippet, which shows no output until Run. */
  readonly snippetVaries: string;
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
  readonly privacyLink: string;

  // The footer's two actions (contact.ts). The `issue*` strings are what a
  // report arrives at GitHub already saying, so they are read by whoever
  // triages it as much as by the reader who sent it.
  readonly footerActions: string;
  readonly reportProblem: string;
  readonly issueTitle: string;
  readonly issueFieldPage: string;
  readonly issueFieldLanguage: string;
  readonly issueLanguageName: string;
  readonly issuePrompt: string;

  readonly contact: string;
  readonly contactTitle: string;
  readonly contactLead: string;
  readonly contactMessage: string;
  readonly contactEmail: string;
  readonly contactEmailOptional: string;
  readonly contactEmailHint: string;
  readonly contactPrivacy: string;
  readonly contactSend: string;
  readonly contactSending: string;
  readonly contactCancel: string;
  readonly contactSent: string;
  readonly contactFailed: string;
  readonly contactNeedMessage: string;
  readonly contactTooLong: string;
  readonly contactBadEmail: string;
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

  navLabel: 'ክፍሎች',
  navMenu: 'ዝርዝር',
  navSteps: 'ትምህርት መቀየሪያ',
  skipToContent: 'ወደ ይዘቱ ዝለል',

  languageToggle: 'English',
  findLabel: 'ማጣቀሻውን ፈልግ',
  themeToggle: 'ጨለማ ገጽታ',

  run: '▸ አሂድ',
  running: 'በመሄድ ላይ…',
  openInPlayground: 'በሜዳ ክፈት',
  snippetLabel: 'የአሃዱ ኮድ',
  snippetVerified: 'ይህ ውጤት በግንባታ ጊዜ ተረጋግጧል',
  snippetFails: 'ይህ ፕሮግራም ሆን ተብሎ ስተት አለው',
  snippetVaries: 'ውጤቱ እንደሚሄድበት ጊዜ ይለያያል፤ ለማየት አሂድን ይጫኑ',
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
  privacyLink: 'ግላዊነት',

  footerActions: 'አስተያየትና ግንኙነት',
  reportProblem: 'ችግር አሳውቁ',
  issueTitle: 'የገጽ ችግር',
  issueFieldPage: 'ገጽ',
  issueFieldLanguage: 'ቋንቋ',
  issueLanguageName: 'አማርኛ',
  issuePrompt: 'ምን ተሳሳተ? እባክዎ ከዚህ በታች ይጻፉ።',

  contact: 'አግኙን',
  contactTitle: 'መልእክት ይላኩ',
  contactLead: 'ስለ ትምህርቶቹ ወይም ስለ ቋንቋው ማለት የሚፈልጉት ነገር ካለ ይጻፉ።',
  contactMessage: 'መልእክት',
  contactEmail: 'ኢሜይል',
  contactEmailOptional: 'አማራጭ ነው',
  contactEmailHint: 'መልስ ከፈለጉ ብቻ',
  contactPrivacy:
    'የሚደርሰን የጻፉት መልእክት፣ ኢሜይሉን ከሞሉት ኢሜይሉ፣ የነበሩበት ገጽ እና ግንኙነትዎ የመጣበት አገር ነው። መልስ ለመስጠት ብቻ ይጠቅማሉ። ሌላ ምንም አይሰበሰብም።',
  contactSend: 'ላክ',
  contactSending: 'በመላክ ላይ…',
  contactCancel: 'ተወው',
  contactSent: 'መልእክቱ ተልኳል። እናመሰግናለን።',
  contactFailed: 'መልእክቱ አልተላከም። የጻፉት እንደተጠበቀ ነው፤ እንደገና መሞከር ይችላሉ ወይም በGitHub ላይ ያሳውቁ።',
  contactNeedMessage: 'እባክዎ መጀመሪያ መልእክት ይጻፉ።',
  contactTooLong: 'መልእክቱ በጣም ረጅም ነው። እባክዎ ያሳጥሩት።',
  contactBadEmail: 'ኢሜይሉ ትክክል አይመስልም። ያስተካክሉት ወይም ባዶውን ይተዉት።',
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

  navLabel: 'Sections',
  navMenu: 'Menu',
  navSteps: 'Lesson steps',
  skipToContent: 'Skip to content',

  languageToggle: 'አማርኛ',
  findLabel: 'Search the reference',
  themeToggle: 'Dark theme',

  run: '▸ Run',
  running: 'Running…',
  openInPlayground: 'Open in playground',
  snippetLabel: 'Ahadu code',
  snippetVerified: 'This output was verified at build time',
  snippetFails: 'This program fails on purpose',
  snippetVaries: 'Its output depends on when it runs — press Run to see it',
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
  privacyLink: 'Privacy',

  footerActions: 'Feedback and contact',
  reportProblem: 'Report a problem',
  issueTitle: 'Problem on a page',
  issueFieldPage: 'Page',
  issueFieldLanguage: 'Language',
  issueLanguageName: 'English',
  issuePrompt: 'What is wrong? Please write below.',

  contact: 'Contact',
  contactTitle: 'Send a message',
  contactLead:
    'If there is something you want to say about the lessons or the language, write it here.',
  contactMessage: 'Message',
  contactEmail: 'Email',
  contactEmailOptional: 'optional',
  contactEmailHint: 'only if you would like a reply',
  contactPrivacy:
    'What reaches us is the message you write, your email address if you fill it in, the page you were on, and the country your connection comes from. They are used only to reply to you. Nothing else is collected.',
  contactSend: 'Send',
  contactSending: 'Sending…',
  contactCancel: 'Cancel',
  contactSent: 'Your message was sent. Thank you.',
  contactFailed:
    'The message could not be sent. What you wrote is still here — try again, or report it on GitHub instead.',
  contactNeedMessage: 'Please write a message first.',
  contactTooLong: 'That message is too long. Please shorten it.',
  contactBadEmail: 'That email address does not look right. Correct it, or leave it empty.',
};

export const LANGUAGES: Record<Language, Strings> = { am, en };

export function strings(language: Language): Strings {
  return LANGUAGES[language];
}

export function otherLanguage(language: Language): Language {
  return language === 'am' ? 'en' : 'am';
}
