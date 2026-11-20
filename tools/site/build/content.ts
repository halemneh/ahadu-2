/**
 * Reading the content tree (SITE.md §3, §4).
 *
 * A page is one Markdown file per language. The two are paired by the `id` in
 * their front matter rather than by filename, because the filenames are in
 * different scripts — `ተማር/01-ሰላም.md` and `learn/01-hello.md` are the same
 * page, and an Amharic reader should not be given an English URL to make the
 * build simpler.
 *
 * Pairing by an explicit id also means a missing translation is detectable: a
 * page present in one language and absent in the other is reported, not
 * quietly skipped.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Language } from './strings.js';

export type Section = 'home' | 'learn' | 'reference' | 'examples';

export interface Meta {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly order: number;
}

export interface SourcePage extends Meta {
  readonly language: Language;
  readonly section: Section;
  readonly slug: string;
  readonly markdown: string;
  readonly file: string;
}

/**
 * Front matter: a `---` block of `key: value` lines.
 *
 * A YAML parser would be a dependency for four keys, and the keys are checked
 * below, so a typo is a build failure rather than an empty heading.
 */
export function parseFrontMatter(text: string, file: string): { meta: Meta; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${file}: no front matter`);

  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const at = line.indexOf(':');
    if (at < 0) throw new Error(`${file}: front matter line is not "key: value": ${line}`);
    fields.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }

  const need = (key: string): string => {
    const value = fields.get(key);
    if (value === undefined || value === '') throw new Error(`${file}: front matter needs ${key}`);
    return value;
  };

  const order = Number(fields.get('order') ?? '0');
  if (!Number.isFinite(order)) throw new Error(`${file}: order is not a number`);

  return {
    meta: { id: need('id'), title: need('title'), summary: need('summary'), order },
    body: text.slice(match[0].length),
  };
}

/** Every page of one language, in order. */
export function readLanguage(
  root: string,
  language: Language,
  sections: Record<Section, string>,
): SourcePage[] {
  const pages: SourcePage[] = [];

  for (const [section, dir] of Object.entries(sections) as [Section, string][]) {
    if (section === 'home') {
      const file = join(root, language, 'index.md');
      const { meta, body } = parseFrontMatter(readFileSync(file, 'utf8'), file);
      pages.push({ ...meta, language, section, slug: '', markdown: body, file });
      continue;
    }

    const base = join(root, language, dir);
    let entries: string[];
    try {
      entries = readdirSync(base).filter((name) => name.endsWith('.md'));
    } catch {
      continue;
    }

    for (const name of entries) {
      const file = join(base, name);
      if (!statSync(file).isFile()) continue;
      const { meta, body } = parseFrontMatter(readFileSync(file, 'utf8'), file);
      pages.push({
        ...meta,
        language,
        section,
        slug: name.replace(/\.md$/, ''),
        markdown: body,
        file,
      });
    }
  }

  return pages.sort((a, b) => a.order - b.order);
}

/**
 * Checks that the two languages describe the same site.
 *
 * Returns the problems rather than throwing, so the caller can report all of
 * them at once — being told about one missing translation at a time is a poor
 * way to find out there are six.
 */
export function pairingProblems(am: readonly SourcePage[], en: readonly SourcePage[]): string[] {
  const problems: string[] = [];
  const byId = (pages: readonly SourcePage[]): Map<string, SourcePage> =>
    new Map(pages.map((page) => [page.id, page]));

  const amById = byId(am);
  const enById = byId(en);

  for (const page of am) {
    if (!enById.has(page.id)) problems.push(`${page.file}: no English page with id "${page.id}"`);
  }
  for (const page of en) {
    if (!amById.has(page.id)) problems.push(`${page.file}: no Amharic page with id "${page.id}"`);
  }

  for (const [id, page] of amById) {
    const other = enById.get(id);
    if (other !== undefined && other.section !== page.section) {
      problems.push(`"${id}" is in ${page.section} in Amharic but ${other.section} in English`);
    }
  }

  return problems;
}
