/**
 * Telling search engines the site is here (SITE.md §3).
 *
 * Two files and a few `<link>` tags. None of it is for readers, and none of it
 * is tracking: nothing is loaded by the browser, nothing is sent anywhere, and
 * a reader who never uses a search engine is unaffected. It is a description of
 * the site's own shape, written down where a crawler will look for it.
 *
 * This matters more here than it would for most new sites, because half the
 * URLs are percent-encoded Ge'ez — `/am/%E1%89%B0%E1%88%9B%E1%88%AD/` — and
 * those are the ones we most want found. Someone searching in Amharic for how
 * to write a program in Amharic is the reader this site was built for, and
 * there is no path by which they reach it today: the site is new and almost
 * nothing links to it.
 *
 * The lists are built from the pages the generator just wrote, so they cannot
 * drift. Renaming a section or adding a lesson updates them, for the same
 * reason the snippets cannot go stale: there is only one list.
 */

/** Where the site actually lives. Absolute URLs are required in both files. */
export const ORIGIN = 'https://ahaducode.com';

export interface SiteUrl {
  /** Absolute from the site root, e.g. `/am/ተማር/`. */
  readonly path: string;
}

function absolute(path: string): string {
  /*
   * Ge'ez paths arrive decoded, because that is how they are written in the
   * content and in every href. A sitemap is XML, and the specification wants
   * each URL escaped as a URI: encodeURI leaves `/` alone and percent-encodes
   * the rest, which is exactly the form the server already answers to.
   */
  return `${ORIGIN}${encodeURI(path)}`;
}

/** XML's five, applied to text that is already a URI. Cheap insurance. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * `sitemap.xml`.
 *
 * Deliberately without `lastmod`. The honest source for it is the date the
 * page's content last changed, and the build cannot see that: file timestamps
 * in a fresh checkout are the time of the checkout, and stamping every page
 * with the build date would claim the whole site changed whenever anything
 * did. Google ignores a `lastmod` it finds unreliable, so a wrong one is worse
 * than none — it teaches the crawler to distrust the file.
 */
export function sitemap(urls: readonly SiteUrl[]): string {
  const entries = [...urls]
    .map((u) => absolute(u.path))
    .sort()
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

/**
 * `robots.txt`.
 *
 * Everything here is public and meant to be read, so nothing is disallowed.
 * The file exists for its last line: without a pointer, a crawler finds the
 * sitemap only by guessing the conventional path.
 */
export function robots(): string {
  return `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
}

export interface Alternates {
  /** This page's own path. */
  readonly self: string;
  readonly am: string;
  readonly en: string;
}

/**
 * The `<head>` links that pair a page with its twin.
 *
 * A page already carried one `hreflang` pointing at the other language, which
 * is half of what the annotation means. Google requires the set to be
 * reciprocal and complete: every page in a group lists every page in the
 * group, itself included, at absolute URLs. A partial set is ignored, so the
 * tag that was there was doing nothing.
 *
 * `x-default` is the page to serve a reader whose language matches neither.
 * It is the Amharic one, which is what `/` already redirects to — the language
 * is the point of the project (SITE.md §3), not a localisation of an English
 * site.
 */
export function headLinks(alt: Alternates): string {
  const canonical = `<link rel="canonical" href="${escapeXml(absolute(alt.self))}" />`;
  const pairs = [
    ['am', alt.am],
    ['en', alt.en],
    ['x-default', alt.am],
  ] as const;

  return [
    canonical,
    ...pairs.map(
      ([lang, path]) =>
        `<link rel="alternate" hreflang="${lang}" href="${escapeXml(absolute(path))}" />`,
    ),
  ].join('\n    ');
}
