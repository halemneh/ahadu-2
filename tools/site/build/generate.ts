/**
 * Turning `content/` into a static site (SITE.md).
 *
 * Runs at build time, from the Vite config, so it has the real interpreter in
 * hand: every code sample is lexed, highlighted and executed here, and a
 * sample whose output is not what its page claims stops the build.
 *
 * The output is plain HTML files. Vite then bundles the client script and the
 * stylesheet they reference; it is not asked to understand the content.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readLanguage, pairingProblems } from './content.js';
import type { Section, SourcePage } from './content.js';
import { render } from './markdown.js';
import { page, lessonSidebar } from './layout.js';
import { LANGUAGES, strings } from './strings.js';
import type { Language } from './strings.js';
import { referenceBody } from './reference.js';
import { SECTION_PATHS } from '../../shared/nav.js';
import { examplesBody } from './examples.js';

/** The same segments the links are built from, so content and URLs agree. */
const SECTIONS: Record<Language, Record<Section, string>> = SECTION_PATHS;

export interface GenerateOptions {
  readonly contentDir: string;
  readonly outDir: string;
  readonly repoDir: string;
}

export interface GenerateResult {
  readonly pages: number;
  readonly snippets: number;
}

function urlOf(p: SourcePage): string {
  if (p.section === 'home') return `/${p.language}/`;
  const dir = SECTIONS[p.language][p.section];
  return p.slug === 'index' ? `/${p.language}/${dir}/` : `/${p.language}/${dir}/${p.slug}/`;
}

export function generate(options: GenerateOptions): GenerateResult {
  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });

  const byLanguage: Record<Language, SourcePage[]> = {
    am: readLanguage(options.contentDir, 'am', SECTIONS.am),
    en: readLanguage(options.contentDir, 'en', SECTIONS.en),
  };

  const problems = pairingProblems(byLanguage.am, byLanguage.en);
  if (problems.length > 0) {
    throw new Error(`the two languages do not describe the same site:\n  ${problems.join('\n  ')}`);
  }

  const urlById = new Map<string, Record<Language, string>>();
  for (const language of Object.keys(LANGUAGES) as Language[]) {
    for (const p of byLanguage[language]) {
      const entry = urlById.get(p.id) ?? { am: '', en: '' };
      entry[language] = urlOf(p);
      urlById.set(p.id, entry);
    }
  }

  let snippets = 0;
  let count = 0;

  for (const language of Object.keys(LANGUAGES) as Language[]) {
    const s = strings(language);
    const pages = byLanguage[language];
    const lessons = pages
      .filter((p) => p.section === 'learn' && p.slug !== 'index')
      .map((p) => ({ url: urlOf(p), title: p.title, order: p.order }));

    for (const source of pages) {
      const url = urlOf(source);
      const other = language === 'am' ? 'en' : 'am';

      // Generated sections append their tables to whatever prose the file has.
      const markdown = source.markdown;
      let extra = '';
      if (source.section === 'reference' && source.slug === 'index') {
        extra = referenceBody(s);
      } else if (source.section === 'examples') {
        extra = examplesBody(options.repoDir);
      }

      const rendered = render({
        markdown: markdown + extra,
        where: source.file,
        strings: s,
        base: `/${language}`,
      });
      snippets += rendered.snippets;

      const index = lessons.findIndex((l) => l.url === url);
      const html = page({
        strings: s,
        title: source.title,
        summary: source.summary,
        section: source.section,
        url,
        counterpart: urlById.get(source.id)?.[other] ?? `/${other}/`,
        body: rendered.html,
        headings: rendered.headings,
        sidebar: source.section === 'learn' ? lessonSidebar(s.lessonsTitle, lessons, url) : '',
        prev: index > 0 ? (lessons[index - 1] ?? null) : null,
        next: index >= 0 && index < lessons.length - 1 ? (lessons[index + 1] ?? null) : null,
      });

      const file = join(options.outDir, url.replace(/^\//, ''), 'index.html');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html, 'utf8');
      count += 1;
    }
  }

  /*
   * A 404 page. GitHub Pages serves `/404.html` for any path it cannot find,
   * and so do most static hosts. Without one a reader who mistypes a lesson
   * URL gets the host's default, which is in neither of this site's languages.
   *
   * It is bilingual because a 404 has no language to go on: the URL that
   * failed is all there was, and it may not have had one.
   */
  const missing = strings('am');
  writeFileSync(
    join(options.outDir, '404.html'),
    page({
      strings: missing,
      title: 'ገጹ አልተገኘም',
      summary: 'Page not found',
      section: 'home',
      url: '/404.html',
      counterpart: '/en/',
      body: `<p>የጠየቁት ገጽ የለም። ምናልባት አድራሻው ተቀይሮ ይሆናል።</p>
        <p class="summary">The page you asked for is not here. It may have moved.</p>
        <p><a href="/am/">ወደ መነሻ ገጽ</a> · <a href="/en/">Home</a> ·
           <a href="/am/ተማር/">ትምህርቶች</a> · <a href="/en/learn/">Lessons</a></p>`,
      headings: [],
      sidebar: '',
      prev: null,
      next: null,
    }),
    'utf8',
  );

  // `/` is Amharic, because the language is (SITE.md §3). A redirect rather
  // than a copy, so the content has exactly one URL.
  writeFileSync(
    join(options.outDir, 'index.html'),
    `<!doctype html>
<html lang="am">
  <head>
    <meta charset="utf-8" />
    <title>አሃዱ</title>
    <link rel="canonical" href="/am/" />
    <meta http-equiv="refresh" content="0; url=/am/" />
  </head>
  <body><a href="/am/">አሃዱ</a></body>
</html>
`,
    'utf8',
  );

  return { pages: count, snippets };
}
