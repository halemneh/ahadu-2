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

  // Editor
  readonly editorLabel: string;

  // The input dialog, shown only when a program calls አንብብ
  readonly inputLabel: string;
  readonly inputHint: string;
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

  editorLabel: 'የአሃዱ ኮድ',
  inputLabel: 'ግቤት',
  inputHint: 'በየመስመሩ አንድ መልስ።',
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

  editorLabel: 'Ahadu code',
  inputLabel: 'Input',
  inputHint: 'One answer per line.',
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
