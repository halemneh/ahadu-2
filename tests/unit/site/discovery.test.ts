/**
 * Being findable (SITE.md §3).
 *
 * The sitemap and the hreflang set are claims made to a crawler about URLs
 * nobody on the team will ever open. A broken one fails silently: the pages
 * simply do not appear in search, months later, with nothing to notice. So
 * the properties that matter are asserted here rather than trusted.
 *
 * The important test is the last one. It checks that the sitemap lists exactly
 * the pages the generator wrote — not a list maintained beside them, which is
 * the thing that always drifts.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORIGIN, headLinks, robots, sitemap } from '../../../tools/site/build/discovery.js';
import { generate } from '../../../tools/site/build/generate.js';

const repo = resolve(fileURLToPath(import.meta.url), '../../../..');

beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => void vi.restoreAllMocks());

describe('sitemap.xml', () => {
  it('is well-formed XML in the sitemaps.org namespace', () => {
    const xml = sitemap([{ path: '/am/' }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('</urlset>');
  });

  it('writes absolute URLs, because a relative one is not a location', () => {
    expect(sitemap([{ path: '/en/learn/' }])).toContain(`<loc>${ORIGIN}/en/learn/</loc>`);
  });

  it('percent-encodes Geʼez, leaving the separators alone', () => {
    const xml = sitemap([{ path: '/am/ተማር/01-ሰላም/' }]);
    expect(xml).toContain(
      '<loc>https://ahaducode.com/am/%E1%89%B0%E1%88%9B%E1%88%AD/01-%E1%88%B0%E1%88%8B%E1%88%9D/</loc>',
    );
    // The slashes survived: a sitemap of one escaped blob would be useless.
    expect(xml).not.toContain('%2F');
  });

  it('claims no lastmod, having no honest source for one', () => {
    expect(sitemap([{ path: '/am/' }])).not.toContain('lastmod');
  });

  it('is sorted, so a diff shows what changed rather than what moved', () => {
    const xml = sitemap([{ path: '/en/reference/' }, { path: '/am/' }, { path: '/en/' }]);
    const order = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(order).toEqual([...order].sort());
  });
});

describe('robots.txt', () => {
  it('disallows nothing, the site being entirely public', () => {
    expect(robots()).not.toContain('Disallow: /\n');
  });

  it('points at the sitemap, which is its reason for existing', () => {
    expect(robots()).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

describe('hreflang', () => {
  const alt = { self: '/en/learn/', am: '/am/ተማር/', en: '/en/learn/' };

  it('names every language in the group, including the page itself', () => {
    const html = headLinks(alt);
    expect(html).toContain('hreflang="am"');
    expect(html).toContain('hreflang="en"');
    // Google ignores a set that does not include the page it is on.
    expect(html).toContain(`hreflang="en" href="${ORIGIN}/en/learn/"`);
  });

  it('sends a reader of neither language to the Amharic page', () => {
    expect(headLinks(alt)).toContain(
      `hreflang="x-default" href="${ORIGIN}/am/%E1%89%B0%E1%88%9B%E1%88%AD/"`,
    );
  });

  it('declares the page its own canonical', () => {
    expect(headLinks(alt)).toContain(`rel="canonical" href="${ORIGIN}/en/learn/"`);
  });

  it('uses absolute URLs throughout, as the annotation requires', () => {
    for (const href of [...headLinks(alt).matchAll(/href="([^"]+)"/g)].map((m) => m[1])) {
      expect(href?.startsWith('https://')).toBe(true);
    }
  });
});

describe('the sitemap against the site that was actually built', () => {
  let out: string;

  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'ahadu-sitemap-'));
  });
  afterEach(() => rmSync(out, { recursive: true, force: true }));

  /**
   * Every page on disk, as the URL it will be served at. Walking the output
   * rather than reading the generator's own return value is the whole point:
   * a sitemap checked against the list that produced it cannot catch a page
   * that was written and never listed.
   */
  function writtenPages(dir: string, prefix = ''): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return writtenPages(path, `${prefix}/${name}`);
      return name === 'index.html' && prefix !== '' ? [`${prefix}/`] : [];
    });
  }

  it('lists every page that was written, and nothing that was not', () => {
    const result = generate({
      contentDir: resolve(repo, 'tools/site/content'),
      outDir: out,
      repoDir: repo,
    });

    const listed = [
      ...readFileSync(join(out, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
    ]
      .map((m) => decodeURI((m[1] ?? '').slice(ORIGIN.length)))
      .sort();

    // The playground is a separate build, so it is in the sitemap but not on
    // disk here; everything else must appear in both.
    const onDisk = [...writtenPages(out), '/playground/'].sort();

    expect(listed).toEqual(onDisk);
    expect(listed).toHaveLength(result.pages + 1);
  });

  it('leaves out the redirect at / and the 404, which are not destinations', () => {
    generate({ contentDir: resolve(repo, 'tools/site/content'), outDir: out, repoDir: repo });
    const xml = readFileSync(join(out, 'sitemap.xml'), 'utf8');
    expect(xml).not.toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).not.toContain('404');
  });

  it('writes robots.txt beside it', () => {
    generate({ contentDir: resolve(repo, 'tools/site/content'), outDir: out, repoDir: repo });
    expect(readFileSync(join(out, 'robots.txt'), 'utf8')).toContain('Sitemap:');
  });
});
