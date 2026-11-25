/**
 * The playground's own text, in Amharic and English (TOOLING.md §2).
 *
 * **What this does not translate**: the Amharic in a diagnostic comes from the
 * interpreter, where LANGUAGE.md §9 makes it normative — a learner reading
 * `ያልታወቀ ተለዋጭ` is reading the language, not the page. A second catalogue here
 * would drift from the spec's own wording, so the message is left as the
 * interpreter produced it. The code beside it (`[AH3001]`) is already
 * language-neutral, and the position line around it is ours and is
 * translated.
 *
 * The English side exists for someone finding their way around the tool
 * itself — a teacher setting it up, or a reader of the spec who does not read
 * Amharic.
 */

export type Language = 'am' | 'en';

export interface Strings {
  readonly language: Language;

  // Chrome
  readonly examples: string;
  readonly examplesNone: string;
  readonly examplesPrograms: string;
  readonly examplesErrors: string;
  readonly run: string;
  readonly stop: string;
  readonly theme: string;
  readonly languageToggle: string;

  // The site header the playground shares with every other page.
  readonly navHome: string;
  readonly navLearn: string;
  readonly navReference: string;
  readonly navExamples: string;
  readonly navPlayground: string;
  /** Names the nav landmark, and the button that opens it on a phone. */
  readonly navLabel: string;
  readonly navMenu: string;

  /** The footer, which the playground shares with every other page. */
  readonly footer: string;
  readonly footerActions: string;
  readonly reportProblem: string;
  readonly privacyLink: string;
  /**
   * The page's h1. It is not drawn: the header says where you are to anyone
   * who can see it. But a page with no h1 gives a screen reader no title to
   * announce and nothing to jump to, and this is the one page of the site
   * whose heading is not in its prose.
   */
  readonly pageTitle: string;

  // Editor
  readonly editorLabel: string;

  // The input dialog, shown only when a program calls አንብብ
  readonly inputLabel: string;
  readonly inputHint: string;
  /** Shown for an `አንብብ` that prints no prompt of its own. */
  readonly inputUnlabelled: string;
  /** Shown when a read sits inside a loop and so repeats. */
  readonly inputRepeats: string;

  /** The contact dialog, shared with every other page. */
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
  readonly contactSent: string;
  readonly contactFailed: string;
  readonly contactNeedMessage: string;
  readonly contactTooLong: string;
  readonly contactBadEmail: string;
  readonly inputWhy: string;
  readonly cancel: string;
  /** `(line, column)` → the position readout under the editor. */
  readonly position: (line: number, column: number) => string;
  /** Shown instead of the position when text is selected. */
  readonly selection: (count: number) => string;

  // Tabs
  readonly tabOutput: string;
  readonly tabTokens: string;
  readonly tabAst: string;
  readonly tabErrors: string;

  // Status
  readonly statusClean: string;
  readonly statusErrors: (count: number) => string;
  readonly statusRunning: string;
  readonly statusDone: string;
  readonly statusStopped: string;

  // Panels
  readonly emptyOutput: string;
  readonly emptyPressRun: string;
  readonly emptyRunning: string;
  readonly emptyTokens: string;
  readonly emptyAst: string;
  readonly emptyErrors: string;
  readonly valuePrefix: string;
  readonly unexpected: string;
  /** `(n)` → "and N more", for the rest of a batch of diagnostics. */
  readonly andMore: (count: number) => string;
  /** The `line N, column M` line inside a diagnostic — ours, not the interpreter's. */
  readonly at: (line: number, column: number) => string;
  readonly traceAt: (line: number, name: string) => string;
}

const amharic: Strings = {
  language: 'am',

  examples: 'ምሳሌዎች',
  examplesNone: 'ምሳሌ ይምረጡ…',
  examplesPrograms: 'ፕሮግራሞች',
  examplesErrors: 'ስተት ያላቸው',
  run: '▸ አሂድ',
  stop: '■ አቁም',
  theme: 'መልክ',
  languageToggle: 'English',
  navHome: 'መነሻ',
  navLearn: 'ተማር',
  navReference: 'ማጣቀሻ',
  navExamples: 'ምሳሌዎች',
  navPlayground: 'ሜዳ',
  footer: 'አሃዱ ነጻ እና ክፍት ምንጭ ነው።',
  footerActions: 'አስተያየትና ግንኙነት',
  reportProblem: 'ችግር አሳውቁ',
  privacyLink: 'ግላዊነት',
  navLabel: 'ክፍሎች',
  navMenu: 'ዝርዝር',
  pageTitle: 'የአሃዱ ሜዳ',

  editorLabel: 'የአሃዱ ኮድ',
  inputLabel: 'ግቤት',
  inputHint: 'በየመስመሩ አንድ መልስ።',
  inputUnlabelled: '(ጥያቄ የለውም)',
  inputRepeats: 'ይህ ፕሮግራም በዑደት ውስጥ ይጠይቃል — ከአንድ ጊዜ በላይ ያነባል። ለእያንዳንዱ መልስ አንድ መስመር ይጻፉ።',
  contact: 'አግኙን',
  contactTitle: 'መልእክት ይላኩ',
  contactLead: 'ስለ ትምህርቶቹ ወይም ስለ ቋንቋው ማለት የሚፈልጉት ነገር ካለ ይጻፉ።',
  contactMessage: 'መልእክት',
  contactEmail: 'ኢሜይል',
  contactEmailOptional: 'አማራጭ ነው',
  contactEmailHint: 'መልስ ከፈለጉ ብቻ',
  contactPrivacy: 'የሚላከው የጻፉት መልእክት ነው፤ ኢሜይሉን ከሞሉት ደግሞ ኢሜይሉ። መልስ ለመስጠት ብቻ ይጠቅማሉ። ሌላ ምንም አይሰበሰብም።',
  contactSend: 'ላክ',
  contactSending: 'በመላክ ላይ…',
  contactSent: 'መልእክቱ ተልኳል። እናመሰግናለን።',
  contactFailed: 'መልእክቱ አልተላከም። የጻፉት እንደተጠበቀ ነው፤ እንደገና መሞከር ይችላሉ ወይም በGitHub ላይ ያሳውቁ።',
  contactNeedMessage: 'እባክዎ መጀመሪያ መልእክት ይጻፉ።',
  contactTooLong: 'መልእክቱ በጣም ረጅም ነው። እባክዎ ያሳጥሩት።',
  contactBadEmail: 'ኢሜይሉ ትክክል አይመስልም። ያስተካክሉት ወይም ባዶውን ይተዉት።',
  inputWhy: 'ይህ ፕሮግራም "አንብብ" ይጠቀማል።',
  cancel: 'ተወው',
  position: (line, column) => `መስመር ${line}፣ ዓምድ ${column}`,
  selection: (count) => `${count} ተመርጧል`,

  tabOutput: 'ውጤት',
  tabTokens: 'ቶከኖች',
  tabAst: 'ዛፍ',
  tabErrors: 'ስተቶች',

  statusClean: 'ምንም ስተት የለም',
  statusErrors: (count) => `${count} ስተት`,
  statusRunning: 'ይሰራል…',
  statusDone: 'ተጠናቋል',
  statusStopped: 'ተቋርጧል',

  emptyOutput: 'ምንም ውጤት የለም',
  emptyPressRun: '"አሂድ" ይጫኑ',
  emptyRunning: 'ይሰራል…',
  emptyTokens: 'ምንም ቶከን የለም',
  emptyAst: 'ምንም ዛፍ የለም',
  emptyErrors: 'ምንም ስተት አልተገኘም።',
  valuePrefix: 'ዋጋ፦',
  unexpected: 'ያልተጠበቀ ስተት።',
  andMore: (count) => `(እና ${count} ተጨማሪ)`,
  at: (line, column) => `መስመር ${line} ላይ: ${column}ኛው ካራክተር`,
  traceAt: (line, name) => `መስመር ${line} ላይ ${name}`,
};

const english: Strings = {
  language: 'en',

  examples: 'Examples',
  examplesNone: 'Choose an example…',
  examplesPrograms: 'Programs',
  examplesErrors: 'With errors',
  run: '▸ Run',
  stop: '■ Stop',
  theme: 'Theme',
  languageToggle: 'አማርኛ',
  navHome: 'Home',
  navLearn: 'Learn',
  navReference: 'Reference',
  navExamples: 'Examples',
  navPlayground: 'Playground',
  footer: 'Ahadu is free and open source.',
  footerActions: 'Feedback and contact',
  reportProblem: 'Report a problem',
  privacyLink: 'Privacy',
  navLabel: 'Sections',
  navMenu: 'Menu',
  pageTitle: 'Ahadu playground',

  editorLabel: 'Ahadu code',
  inputLabel: 'Input',
  inputHint: 'One answer per line.',
  inputUnlabelled: '(no prompt)',
  inputRepeats:
    'This program asks inside a loop, so it reads more than once. Write one line for each answer.',
  contact: 'Contact',
  contactTitle: 'Send a message',
  contactLead:
    'If there is something you want to say about the lessons or the language, write it here.',
  contactMessage: 'Message',
  contactEmail: 'Email',
  contactEmailOptional: 'optional',
  contactEmailHint: 'only if you would like a reply',
  contactPrivacy:
    'What is sent is the message you write, and your email address if you fill it in. They are used only to reply to you. Nothing else is collected.',
  contactSend: 'Send',
  contactSending: 'Sending…',
  contactSent: 'Your message was sent. Thank you.',
  contactFailed:
    'The message could not be sent. What you wrote is still here — try again, or report it on GitHub instead.',
  contactNeedMessage: 'Please write a message first.',
  contactTooLong: 'That message is too long. Please shorten it.',
  contactBadEmail: 'That email address does not look right. Correct it, or leave it empty.',
  inputWhy: 'This program calls አንብብ.',
  cancel: 'Cancel',
  position: (line, column) => `Ln ${line}, Col ${column}`,
  selection: (count) => `${count} selected`,

  tabOutput: 'Output',
  tabTokens: 'Tokens',
  tabAst: 'Tree',
  tabErrors: 'Errors',

  statusClean: 'No errors',
  statusErrors: (count) => `${count} error${count === 1 ? '' : 's'}`,
  statusRunning: 'Running…',
  statusDone: 'Finished',
  statusStopped: 'Stopped',

  emptyOutput: 'No output',
  emptyPressRun: 'Press Run',
  emptyRunning: 'Running…',
  emptyTokens: 'No tokens',
  emptyAst: 'No tree',
  emptyErrors: 'No errors found.',
  valuePrefix: 'Value:',
  unexpected: 'Unexpected error.',
  andMore: (count) => `(and ${count} more)`,
  at: (line, column) => `line ${line}, column ${column}`,
  traceAt: (line, name) => `line ${line} in ${name}`,
};

export const LANGUAGES: Record<Language, Strings> = { am: amharic, en: english };

export function strings(language: Language): Strings {
  return LANGUAGES[language];
}

/** The other language, for a toggle. */
export function otherLanguage(language: Language): Language {
  return language === 'am' ? 'en' : 'am';
}
