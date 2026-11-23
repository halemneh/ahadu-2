/**
 * Where the site's sections live, in each language (SITE.md §3).
 *
 * One definition, imported by the generator that writes the pages, the layout
 * that links between them, and the playground's own header. These are URLs a
 * reader can bookmark; three copies of them would eventually disagree, and the
 * symptom would be a dead link in one corner of the site.
 *
 * Each language has its own segments, in its own script. `/en/ተማር/` would be
 * as wrong as `/am/learn/`.
 */

export type Language = 'am' | 'en';

/**
 * `privacy` is a real section with its own page in each language, but it is
 * not in the top navigation — it belongs in the footer, where someone goes
 * looking for it, rather than competing with the lessons for attention.
 */
export type Section = 'home' | 'learn' | 'reference' | 'examples' | 'privacy';

export const SECTION_PATHS: Readonly<Record<Language, Readonly<Record<Section, string>>>> = {
  am: { home: '', learn: 'ተማር', reference: 'ማጣቀሻ', examples: 'ምሳሌዎች', privacy: 'ግላዊነት' },
  en: {
    home: '',
    learn: 'learn',
    reference: 'reference',
    examples: 'examples',
    privacy: 'privacy',
  },
};

/** The playground has one URL: it is not written twice, so it is not translated. */
export const PLAYGROUND_URL = '/playground/';

/** The absolute URL of a section in one language. */
export function sectionUrl(language: Language, section: Section): string {
  const path = SECTION_PATHS[language][section];
  return path === '' ? `/${language}/` : `/${language}/${path}/`;
}

/** Keys shared by every page, so a setting made on one is honoured by the next. */
export const STORAGE = {
  theme: 'ahadu.theme',
  language: 'ahadu.language',
} as const;
