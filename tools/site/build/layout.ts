/**
 * The page shell (SITE.md §3).
 *
 * Plain HTML written as a string. The site has one layout and four section
 * variants; a template engine would be a dependency and an indirection for
 * something a function does in sixty lines.
 *
 * Everything the reader needs is in the HTML before any script runs: the prose,
 * the code samples, their highlighting and their verified output. Scripts add
 * the ability to edit and re-run a snippet. A lesson still teaches with
 * JavaScript switched off, which matters for a site whose readers may be on
 * whatever device a school has.
 */

import { escapeHtml } from '../../playground/view.js';
import type { Strings } from './strings.js';
import type { Section } from './content.js';

export interface PageView {
  readonly strings: Strings;
  readonly title: string;
  readonly summary: string;
  readonly section: Section;
  /** This page's own URL, absolute from the site root. */
  readonly url: string;
  /** The same page in the other language. */
  readonly counterpart: string;
  readonly body: string;
  readonly headings: readonly { readonly id: string; readonly text: string }[];
  readonly sidebar: string;
  readonly prev: { readonly url: string; readonly title: string } | null;
  readonly next: { readonly url: string; readonly title: string } | null;
}

export function page(view: PageView): string {
  const s = view.strings;
  const home = `/${s.code}/`;

  const nav = [
    link(home, s.navHome, view.section === 'home'),
    link(`${home}${s.pathLearn}/`, s.navLearn, view.section === 'learn'),
    link(`${home}${s.pathReference}/`, s.navReference, view.section === 'reference'),
    link(`${home}${s.pathExamples}/`, s.navExamples, view.section === 'examples'),
    link('/playground/', s.navPlayground, false),
  ].join('\n        ');

  const contents =
    view.headings.length < 2
      ? ''
      : `<nav class="toc" aria-label="${escapeHtml(s.onThisPage)}">
          <h2>${escapeHtml(s.onThisPage)}</h2>
          <ul>${view.headings
            .map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
            .join('')}</ul>
        </nav>`;

  const steps =
    view.prev === null && view.next === null
      ? ''
      : `<nav class="steps">
          ${
            view.prev === null
              ? '<span></span>'
              : `<a class="step step-prev" href="${view.prev.url}"><span>${escapeHtml(
                  s.previous,
                )}</span><strong>${escapeHtml(view.prev.title)}</strong></a>`
          }
          ${
            view.next === null
              ? '<span></span>'
              : `<a class="step step-next" href="${view.next.url}"><span>${escapeHtml(
                  s.next,
                )}</span><strong>${escapeHtml(view.next.title)}</strong></a>`
          }
        </nav>`;

  return `<!doctype html>
<html lang="${s.code}" dir="${s.dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(view.title)} — ${escapeHtml(s.siteName)}</title>
    <meta name="description" content="${escapeHtml(view.summary)}" />
    <link rel="alternate" hreflang="${s.code === 'am' ? 'en' : 'am'}" href="${view.counterpart}" />
    <link rel="stylesheet" href="/theme/site.css" />
    <script>
      // Before first paint, so a reader who chose dark never sees a white flash.
      try {
        var t = localStorage.getItem('ahadu.theme');
        if (t) document.documentElement.dataset.theme = t;
      } catch (e) {}
    </script>
  </head>
  <body data-section="${view.section}">
    <a class="skip" href="#main">${escapeHtml(view.title)}</a>

    <header class="bar">
      <a class="brand" href="${home}">
        <strong>${escapeHtml(s.siteName)}</strong>
        <span class="version">2.0</span>
      </a>

      <nav class="nav">
        ${nav}
      </nav>

      <div class="spacer"></div>

      <a class="chip" href="${view.counterpart}" rel="alternate">${escapeHtml(s.languageToggle)}</a>
      <button class="chip" type="button" id="theme" aria-label="${escapeHtml(s.themeToggle)}">◐</button>
    </header>

    <div class="shell${view.sidebar === '' ? ' shell-plain' : ''}">
      ${view.sidebar === '' ? '' : `<aside class="side">${view.sidebar}</aside>`}

      <main id="main" class="doc">
        <article>
          <h1>${escapeHtml(view.title)}</h1>
          <p class="summary">${escapeHtml(view.summary)}</p>
          ${view.body}
        </article>
        ${steps}
      </main>

      ${contents}
    </div>

    <footer class="foot">
      <span>${escapeHtml(s.footer)}</span>
      <a href="https://github.com/halemneh/ahadu-2">GitHub</a>
    </footer>

    <script type="module" src="/client/main.ts"></script>
  </body>
</html>
`;
}

function link(href: string, text: string, current: boolean): string {
  return `<a href="${href}"${current ? ' aria-current="page"' : ''}>${escapeHtml(text)}</a>`;
}

/** The lesson list that runs down the side of every lesson. */
export function lessonSidebar(
  title: string,
  lessons: readonly { readonly url: string; readonly title: string; readonly order: number }[],
  current: string,
): string {
  return `<h2>${escapeHtml(title)}</h2>
        <ol class="lessons">${lessons
          .map(
            (lesson) =>
              `<li><a href="${lesson.url}"${
                lesson.url === current ? ' aria-current="page"' : ''
              }>${escapeHtml(lesson.title)}</a></li>`,
          )
          .join('')}</ol>`;
}
