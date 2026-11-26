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

import { createHash } from 'node:crypto';
import { escapeHtml } from '../../playground/view.js';
import { contentSecurityPolicy } from '../../shared/csp.js';
import { PLAYGROUND_URL, STORAGE, sectionUrl } from '../../shared/nav.js';
import { contactDialog, footerActions } from './contact.js';
import { headLinks } from './discovery.js';
import type { Alternates } from './discovery.js';
import { otherLanguage } from './strings.js';
import type { Strings } from './strings.js';
import type { Section } from './content.js';

/** A CSP hash source for an inline script's exact text. */
export function scriptHash(text: string): string {
  return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

/**
 * The home page's background: the fidel, laid out as the chart a learner
 * first meets it in — two consonants per row, each with its seven vowel
 * forms, in the order the alphabet is recited. Twenty-four families and then
 * the numerals: enough rows to carry the first screenful.
 *
 * Text and not an image, so it costs no request and honours §6.1's rule that
 * the site fetches nothing from anywhere. It ends on the Ge'ez numerals,
 * because those are the part of the script a programmer is least likely to
 * have seen and the part Ahadu actually computes with.
 *
 * Each glyph is its own element so a row can be spread edge to edge rather
 * than running off one side: the rows are different widths in the font, and
 * a block of text could only ever be flush on one margin.
 *
 * `aria-hidden`: a screen reader announcing a hundred and eighty-two syllables before the
 * heading would be worse than no texture at all.
 */
const FIDEL_GRID = `<div class="fidel" aria-hidden="true">
      <span><i>ሀ</i><i>ሁ</i><i>ሂ</i><i>ሃ</i><i>ሄ</i><i>ህ</i><i>ሆ</i><i>ለ</i><i>ሉ</i><i>ሊ</i><i>ላ</i><i>ሌ</i><i>ል</i><i>ሎ</i></span>
      <span><i>ሐ</i><i>ሑ</i><i>ሒ</i><i>ሓ</i><i>ሔ</i><i>ሕ</i><i>ሖ</i><i>መ</i><i>ሙ</i><i>ሚ</i><i>ማ</i><i>ሜ</i><i>ም</i><i>ሞ</i></span>
      <span><i>ሠ</i><i>ሡ</i><i>ሢ</i><i>ሣ</i><i>ሤ</i><i>ሥ</i><i>ሦ</i><i>ረ</i><i>ሩ</i><i>ሪ</i><i>ራ</i><i>ሬ</i><i>ር</i><i>ሮ</i></span>
      <span><i>ሰ</i><i>ሱ</i><i>ሲ</i><i>ሳ</i><i>ሴ</i><i>ስ</i><i>ሶ</i><i>ሸ</i><i>ሹ</i><i>ሺ</i><i>ሻ</i><i>ሼ</i><i>ሽ</i><i>ሾ</i></span>
      <span><i>ቀ</i><i>ቁ</i><i>ቂ</i><i>ቃ</i><i>ቄ</i><i>ቅ</i><i>ቆ</i><i>በ</i><i>ቡ</i><i>ቢ</i><i>ባ</i><i>ቤ</i><i>ብ</i><i>ቦ</i></span>
      <span><i>ተ</i><i>ቱ</i><i>ቲ</i><i>ታ</i><i>ቴ</i><i>ት</i><i>ቶ</i><i>ቸ</i><i>ቹ</i><i>ቺ</i><i>ቻ</i><i>ቼ</i><i>ች</i><i>ቾ</i></span>
      <span><i>ኀ</i><i>ኁ</i><i>ኂ</i><i>ኃ</i><i>ኄ</i><i>ኅ</i><i>ኆ</i><i>ነ</i><i>ኑ</i><i>ኒ</i><i>ና</i><i>ኔ</i><i>ን</i><i>ኖ</i></span>
      <span><i>ኘ</i><i>ኙ</i><i>ኚ</i><i>ኛ</i><i>ኜ</i><i>ኝ</i><i>ኞ</i><i>አ</i><i>ኡ</i><i>ኢ</i><i>ኣ</i><i>ኤ</i><i>እ</i><i>ኦ</i></span>
      <span><i>ከ</i><i>ኩ</i><i>ኪ</i><i>ካ</i><i>ኬ</i><i>ክ</i><i>ኮ</i><i>ኸ</i><i>ኹ</i><i>ኺ</i><i>ኻ</i><i>ኼ</i><i>ኽ</i><i>ኾ</i></span>
      <span><i>ወ</i><i>ዉ</i><i>ዊ</i><i>ዋ</i><i>ዌ</i><i>ው</i><i>ዎ</i><i>ዐ</i><i>ዑ</i><i>ዒ</i><i>ዓ</i><i>ዔ</i><i>ዕ</i><i>ዖ</i></span>
      <span><i>ዘ</i><i>ዙ</i><i>ዚ</i><i>ዛ</i><i>ዜ</i><i>ዝ</i><i>ዞ</i><i>ዠ</i><i>ዡ</i><i>ዢ</i><i>ዣ</i><i>ዤ</i><i>ዥ</i><i>ዦ</i></span>
      <span><i>የ</i><i>ዩ</i><i>ዪ</i><i>ያ</i><i>ዬ</i><i>ይ</i><i>ዮ</i><i>ደ</i><i>ዱ</i><i>ዲ</i><i>ዳ</i><i>ዴ</i><i>ድ</i><i>ዶ</i></span>
      <span><i>፩</i><i>፪</i><i>፫</i><i>፬</i><i>፭</i><i>፮</i><i>፯</i><i>፰</i><i>፱</i><i>፲</i><i>፳</i><i>፴</i><i>፻</i><i>፼</i></span>
    </div>`;

export interface PageView {
  readonly strings: Strings;
  readonly title: string;
  readonly summary: string;
  readonly section: Section;
  /** This page's own URL, absolute from the site root. */
  readonly url: string;
  /** The same page in the other language. */
  readonly counterpart: string;
  /** Every language this page exists in, for hreflang and canonical. */
  readonly alternates: Alternates;
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
    link(sectionUrl(s.code, 'home'), s.navHome, view.section === 'home'),
    link(sectionUrl(s.code, 'learn'), s.navLearn, view.section === 'learn'),
    link(sectionUrl(s.code, 'reference'), s.navReference, view.section === 'reference'),
    link(sectionUrl(s.code, 'examples'), s.navExamples, view.section === 'examples'),
    link(PLAYGROUND_URL, s.navPlayground, false),
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
      : `<nav class="steps" aria-label="${escapeHtml(s.navSteps)}">
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

  // The pre-paint script, kept in a variable so the policy can allow exactly
  // this text by its hash and nothing else inline.
  const boot = `
      try {
        // Before first paint, so a reader who chose dark never sees a flash.
        var t = localStorage.getItem('${STORAGE.theme}');
        if (t) document.documentElement.dataset.theme = t;
        /*
         * Says that scripting is on, before anything is drawn. The narrow
         * navigation is a drawer only under this class: without it the nav
         * stays as a plain wrapped list, which works with no JavaScript at
         * all — and a hamburger that cannot open is worse than two lines of
         * links.
         */
        document.documentElement.className += ' js';
        // This page's language is in its URL. Record it, so the playground —
        // which has one URL for both — opens in the language being read.
        localStorage.setItem('${STORAGE.language}', '${s.code}');
      } catch (e) {}
    `;

  return `<!doctype html>
<html lang="${s.code}" dir="${s.dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(view.title)} — ${escapeHtml(s.siteName)}</title>
    <meta name="description" content="${escapeHtml(view.summary)}" />
    ${headLinks(view.alternates)}
    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy([scriptHash(boot)])}" />
    <meta name="referrer" content="no-referrer" />
    <link rel="stylesheet" href="/theme/site.css" />
    <script>${boot}</script>
  </head>
  <body data-section="${view.section}">
    <!--
      "Skip to content", not the page's title: a skip link is read out of
      context, as the first thing on the page, and a title there says nothing
      about what the link does.
    -->
    <a class="skip" href="#main">${escapeHtml(s.skipToContent)}</a>

    <header class="sitebar">
      <a class="brand" href="${home}">
        <strong>አሃዱ</strong>
      </a>

      <!--
        The sections. Below 760px this becomes a drawer, opened by #menu —
        but only when scripting is on (see the js class set above), because
        a drawer that cannot open would hide the whole site.
      -->
      <nav class="nav" id="sitenav" aria-label="${escapeHtml(s.navLabel)}">
        ${nav}
      </nav>

      <div class="spacer"></div>

      <!--
        Searches the reference, from any page. The index is built in the
        browser on the first keystroke, so this costs nothing until used.
      -->
      <div class="find">
        <input
          id="find"
          class="find-box"
          type="search"
          autocomplete="off"
          role="combobox"
          aria-expanded="false"
          aria-controls="find-results"
          aria-label="${escapeHtml(s.findLabel)}"
          placeholder="${escapeHtml(s.findLabel)}"
        />
        <ul id="find-results" class="find-results" role="listbox" hidden></ul>
      </div>

      <a class="chip" href="${view.counterpart}" rel="alternate" lang="${otherLanguage(s.code)}" hreflang="${otherLanguage(s.code)}">${escapeHtml(s.languageToggle)}</a>
      <button class="chip" type="button" id="theme" aria-label="${escapeHtml(s.themeToggle)}">◐</button>
      <button
        class="chip menu"
        type="button"
        id="menu"
        aria-controls="sitenav"
        aria-expanded="false"
        aria-label="${escapeHtml(s.navMenu)}"
        hidden
      ><span aria-hidden="true">☰</span></button>
    </header>

    <!-- Closes the drawer when the page behind it is tapped. -->
    <div class="scrim" id="nav-scrim" hidden></div>

    <!--
      The document comes before the lesson list in the markup and is put back
      on the left by the grid. Two reasons, and they are the same reason: a
      page whose first heading is an h2 in the margin has its outline upside
      down, and on a phone — where the grid collapses to one column and
      source order *is* reading order — a reader met eight lesson links
      before the lesson they had opened.
    -->
    ${view.section === 'home' ? FIDEL_GRID : ''}

    <div class="shell${view.section === 'home' ? ' shell-home' : view.sidebar === '' ? ' shell-plain' : ''}">
      <main id="main" class="doc">
        <article>
          <h1>${escapeHtml(view.title)}</h1>
          <p class="summary">${escapeHtml(view.summary)}</p>
          ${view.body}
        </article>
        ${steps}
      </main>

      ${
        view.sidebar === ''
          ? ''
          : `<nav class="side" aria-label="${escapeHtml(s.lessonsTitle)}">${view.sidebar}</nav>`
      }

      ${contents}
    </div>

    <footer class="foot">
      <span>${escapeHtml(s.footer)}</span>
      ${footerActions({ strings: s, url: view.url })}
    </footer>

    ${contactDialog({ strings: s, url: view.url })}

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
