/**
 * What the live-site health check decides (`tools/site/health.mjs`).
 *
 * The script itself can only be judged against the internet, which is the one
 * thing a test must not need. So the parsing and the decisions are pure, and
 * this is where they are pinned down.
 *
 * Two of these are not really tests of the script at all but of the agreement
 * between it and the site: the list of URLs it insists on, against the section
 * paths in `shared/nav.ts`, and its two hostnames against the ones the pages
 * are built with. A monitor that has quietly stopped watching a renamed
 * section is worse than no monitor, because it still goes green. Rename a
 * section and this fails, here, with the file to edit named in the message.
 */

import { describe, expect, it } from 'vitest';
import {
  CERT_FAILS_WITHIN_DAYS,
  CONTACT,
  REQUIRED_PATHS,
  SITE,
  certificateDaysLeft,
  certificateOk,
  isContactAlive,
  isInternal,
  links,
  metaRefreshTarget,
  moduleScripts,
  requestKey,
  sitemapPaths,
  workerAssets,
} from '../../../tools/site/health.mjs';
import { CONTACT_ENDPOINT, SITE_ORIGIN } from '../../../tools/site/build/contact.js';
import { PLAYGROUND_URL, SECTION_PATHS, sectionUrl } from '../../../tools/shared/nav.js';
import type { Language, Section } from '../../../tools/shared/nav.js';

/** Both languages and all of their sections, read off the one definition. */
const LANGUAGES = Object.keys(SECTION_PATHS) as Language[];

function sections(language: Language): Section[] {
  return Object.keys(SECTION_PATHS[language]) as Section[];
}

/** Build day: a fixed point, so "21 days left" means the same next year. */
const NOW = Date.parse('2026-11-22T00:00:00Z');

function inDays(days: number): string {
  return new Date(NOW + days * 86_400_000).toUTCString();
}

describe('the list of URLs the check insists on', () => {
  it('covers every section of both languages', () => {
    for (const language of LANGUAGES) {
      for (const section of sections(language)) {
        const url = sectionUrl(language, section);
        expect(
          REQUIRED_PATHS,
          `${url} is a section of the site but tools/site/health.mjs does not check it`,
        ).toContain(url);
      }
    }
  });

  it('covers the root and the playground', () => {
    expect(REQUIRED_PATHS).toContain('/');
    expect(REQUIRED_PATHS).toContain(PLAYGROUND_URL);
  });

  it('checks nothing that is not a real URL of the site', () => {
    const real = new Set<string>(['/', PLAYGROUND_URL]);
    for (const language of LANGUAGES) {
      for (const section of sections(language)) {
        real.add(sectionUrl(language, section));
      }
    }
    for (const path of REQUIRED_PATHS) expect(real).toContain(path);
  });

  it('watches the hosts the pages are actually built with', () => {
    expect(SITE).toBe(SITE_ORIGIN);
    expect(CONTACT).toBe(CONTACT_ENDPOINT);
  });
});

describe('the root page’s meta refresh', () => {
  // The only reason `/` reaches `/am/` on GitHub Pages (DEPLOY.md), and the
  // only check here that a 200 cannot stand in for.
  const root = [
    '<!doctype html>',
    '<html lang="am"><head>',
    '<link rel="canonical" href="/am/" />',
    '<meta http-equiv="refresh" content="0; url=/am/" />',
    '</head><body><a href="/am/">አሃዱ</a></body></html>',
  ].join('\n');

  it('is read off the page as served', () => {
    expect(metaRefreshTarget(root)).toBe('/am/');
  });

  it('is absent when the tag has been dropped', () => {
    expect(metaRefreshTarget(root.replace(/<meta http-equiv[^>]*>/, ''))).toBeNull();
  });

  it('is not confused by the canonical link beside it', () => {
    expect(metaRefreshTarget('<link rel="canonical" href="/am/">')).toBeNull();
  });

  it('is reported as it stands when it points somewhere else', () => {
    // A refresh to the wrong place is a different failure from no refresh at
    // all, and the operator wants to see which.
    expect(metaRefreshTarget('<meta http-equiv="refresh" content="0; url=/en/">')).toBe('/en/');
  });
});

describe('the playground’s bundle', () => {
  const page =
    '<script>var t = localStorage.getItem("ahadu.theme");</script>' +
    '<script type="module" crossorigin src="/playground/assets/index-acF5GfhI.js"></script>' +
    '<link rel="stylesheet" href="/playground/assets/index-BPeOkJqp.css">';

  it('is found by its module script, not by the inline one beside it', () => {
    expect(moduleScripts(page)).toEqual(['/playground/assets/index-acF5GfhI.js']);
  });

  it('names the worker Vite hashed for it', () => {
    const built =
      'I=new Worker(new URL("/playground/assets/worker-dbvH5IdZ.js",import.meta.url),' +
      '{type:"module"}),I.on';
    expect(workerAssets(built)).toEqual(['/playground/assets/worker-dbvH5IdZ.js']);
  });

  it('names it once however many times the bundle mentions it', () => {
    const twice =
      'worker: "/playground/assets/worker-aa11.js", retry: "/playground/assets/worker-aa11.js"';
    expect(workerAssets(twice)).toHaveLength(1);
  });

  it('names nothing when the worker has fallen out of the bundle', () => {
    // Which the script treats as a failure: a playground whose Run button
    // does nothing serves a page and teaches no one.
    expect(workerAssets('const run = () => evaluate(source);')).toEqual([]);
  });
});

describe('the links found on a page', () => {
  const page = '/en/learn/01-hello/';
  const found = links(
    [
      '<a href="/en/learn/02-variables/">next</a>',
      '<a href="#exercise">the exercise</a>',
      '<a href="">nothing</a>',
      '<a href="mailto:someone@example.com">mail</a>',
      '<a href="javascript:void 0">script</a>',
      '<a href="02-variables/">relative</a>',
      '<a href="https://github.com/halemneh/ahadu-2/issues/new?title=a&amp;body=b">report</a>',
      '<script src="/assets/main-lfT9EcH8.js"></script>',
    ].join('\n'),
    `${SITE}${page}`,
  );

  it('includes both hrefs and srcs', () => {
    expect(found).toContain(`${SITE}/en/learn/02-variables/`);
    expect(found).toContain(`${SITE}/assets/main-lfT9EcH8.js`);
  });

  it('resolves a relative href against the page it was on', () => {
    expect(found).toContain(`${SITE}/en/learn/01-hello/02-variables/`);
  });

  it('leaves out a bare fragment, an empty href, and anything not http', () => {
    expect(found.some((url) => url.includes('#'))).toBe(false);
    expect(found.some((url) => url.startsWith('mailto:'))).toBe(false);
    expect(found.some((url) => url.startsWith('javascript:'))).toBe(false);
    expect(found).toHaveLength(4);
  });

  it('un-escapes the ampersands HTML put in a query', () => {
    // Or the report link would be requested with a literal `&amp;` in it,
    // which is a different URL and, on a bad day, a different answer.
    expect(found).toContain('https://github.com/halemneh/ahadu-2/issues/new?title=a&body=b');
  });
});

describe('which requests count as the same request', () => {
  it('drops the fragment, which never reaches a server', () => {
    const program = `${SITE}/playground/#4Yy74Y2NKCLhiLDhiIvhiJ0iKQ`;
    expect(requestKey(program)).toBe(requestKey(`${SITE}/playground/`));
  });

  it('keeps the query on the site, where a query could mean a page', () => {
    expect(requestKey(`${SITE}/en/?a=1`)).not.toBe(requestKey(`${SITE}/en/`));
  });

  it('drops the query on somebody else’s site', () => {
    // Every page of this site carries its own pre-filled issue link. They are
    // thirty-odd URLs and one GitHub page, and asking thirty times a run would
    // be rude for no extra information.
    const am = 'https://github.com/halemneh/ahadu-2/issues/new?title=%2Fam%2F';
    const en = 'https://github.com/halemneh/ahadu-2/issues/new?title=%2Fen%2F';
    expect(requestKey(am)).toBe(requestKey(en));
  });

  it('tells the site apart from everywhere else', () => {
    expect(isInternal(`${SITE}/am/`)).toBe(true);
    expect(isInternal(CONTACT)).toBe(false);
    expect(isInternal('https://github.com/halemneh/ahadu-2')).toBe(false);
  });
});

describe('the certificate', () => {
  it('is counted in whole days from now', () => {
    expect(certificateDaysLeft(inDays(89), NOW)).toBe(89);
    expect(certificateDaysLeft('Feb 20 19:38:21 2027 GMT', NOW)).toBe(90);
  });

  it('passes while there is more than three weeks of it', () => {
    expect(certificateOk(inDays(90), NOW)).toBe(true);
    expect(certificateOk(inDays(CERT_FAILS_WITHIN_DAYS), NOW)).toBe(true);
  });

  it('fails inside three weeks, which is after GitHub should have renewed it', () => {
    expect(certificateOk(inDays(CERT_FAILS_WITHIN_DAYS - 1), NOW)).toBe(false);
    expect(certificateOk(inDays(0), NOW)).toBe(false);
    expect(certificateOk(inDays(-1), NOW)).toBe(false);
  });

  it('fails rather than passes when the date cannot be read', () => {
    expect(certificateDaysLeft('whenever', NOW)).toBeNull();
    expect(certificateOk('whenever', NOW)).toBe(false);
  });
});

describe('the contact endpoint', () => {
  it('is alive when it refuses a GET, which is what it is meant to do', () => {
    expect(isContactAlive('{"ok":false,"error":"method"}')).toBe(true);
  });

  it('is not judged by anything that would need a POST to find out', () => {
    // The cron must never send a real message: the Worker mails the
    // maintainer, and a monitor that mails hourly is a monitor that is
    // filtered into a folder nobody opens.
    expect(isContactAlive('{"ok":true}')).toBe(false);
  });

  it('is not alive when something else answers for it', () => {
    expect(isContactAlive('<html><body>502 Bad Gateway</body></html>')).toBe(false);
    expect(isContactAlive('')).toBe(false);
    expect(isContactAlive('{"ok":false,"error":"empty"}')).toBe(false);
  });
});

describe('the sitemap, as the health check reads it', () => {
  it('returns a path for each entry', () => {
    const xml = `<urlset><url><loc>https://ahaducode.com/en/learn/</loc></url></urlset>`;
    expect(sitemapPaths(xml)).toEqual(['/en/learn/']);
  });

  it('keeps Geʼez in the encoded form the server answers to', () => {
    const xml = `<url><loc>https://ahaducode.com/am/%E1%89%B0%E1%88%9B%E1%88%AD/</loc></url>`;
    expect(sitemapPaths(xml)).toEqual(['/am/%E1%89%B0%E1%88%9B%E1%88%AD/']);
  });

  it('drops an entry that is not a URL rather than throwing', () => {
    expect(sitemapPaths('<loc>not a url</loc><loc>https://a.test/x</loc>')).toEqual(['/x']);
  });

  it('finds nothing in a page that is not a sitemap, such as a 404', () => {
    expect(sitemapPaths('<html><body>404</body></html>')).toEqual([]);
  });
});
