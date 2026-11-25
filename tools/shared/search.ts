/**
 * Searching the reference, from the header, with nothing fetched.
 *
 * The index is built in the browser out of the very things the reference
 * page is generated from — `KEYWORDS`, `MESSAGES` and the function entries —
 * so a name that exists is findable and a name that does not cannot be
 * listed. There is no index file to keep in step and no request to make,
 * which matters because SITE.md §6 does not allow one.
 *
 * Results link into the reference by anchor. The function cards carry an id
 * per form, so a search for `ርዝመት` lands on the form you picked rather than
 * on a page you then have to read through.
 */

import { KEYWORDS } from '../../src/lexer/constants.js';
import { MESSAGES } from '../../src/diagnostics.js';
import { FN_ENTRIES, GLOSS } from '../site/build/functions.js';
import { SECTION_PATHS } from './nav.js';
import type { Language } from './nav.js';

interface Hit {
  /** What is shown in bold: a signature, a word, a code. */
  readonly title: string;
  /** The one-line explanation under it. */
  readonly note: string;
  /** Where in the reference it lives. */
  readonly href: string;
  /** Everything matched against, folded for comparison. */
  readonly haystack: string;
}

const REFERENCE: Record<Language, string> = {
  am: `/am/${SECTION_PATHS.am.reference}/`,
  en: `/en/${SECTION_PATHS.en.reference}/`,
};

/** Case and Ethiopic punctuation are not worth making someone type. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[፣።፤፦()[\]"']/g, '');
}

export function buildIndex(language: Language): Hit[] {
  const base = REFERENCE[language];
  const hits: Hit[] = [];

  for (const entry of FN_ENTRIES) {
    const note = language === 'am' ? entry.am : entry.en;
    hits.push({
      title: entry.sig,
      note,
      href: `${base}#fn-${encodeURIComponent(entry.sig)}`,
      // The English terms too: someone who knows what a sort is but not
      // that it is called ደርድር should still find it.
      haystack: fold(`${entry.name} ${entry.sig} ${note} ${entry.also}`),
    });
  }

  const byType = new Map<string, string[]>();
  for (const [word, type] of Object.entries(KEYWORDS)) {
    byType.set(type, [...(byType.get(type) ?? []), word]);
  }
  for (const [type, words] of byType) {
    const note = GLOSS[type]?.[language] ?? type;
    hits.push({
      title: words.join('  '),
      note,
      href: `${base}#keywords`,
      haystack: fold(`${words.join(' ')} ${note} ${type}`),
    });
  }

  for (const [code, message] of Object.entries(MESSAGES)) {
    hits.push({
      title: code,
      note: message,
      href: `${base}#error-codes`,
      haystack: fold(`${code} ${message}`),
    });
  }

  return hits;
}

/** The best handful, exact-prefix first so a typed name leads. */
export function search(index: readonly Hit[], query: string, limit = 8): Hit[] {
  const needle = fold(query.trim());
  if (needle === '') return [];
  const starts = index.filter((hit) => hit.haystack.startsWith(needle));
  const rest = index.filter(
    (hit) => !hit.haystack.startsWith(needle) && hit.haystack.includes(needle),
  );
  return [...starts, ...rest].slice(0, limit);
}

/**
 * Wires the header's search box, if the page has one.
 *
 * Keyboard first: the results are a listbox, Up and Down move through them,
 * Enter opens the highlighted one and Escape closes. A reader who never
 * touches the mouse can still get from any page to any entry.
 */
export function setUpSearch(): void {
  const box = document.getElementById('find');
  const list = document.getElementById('find-results');
  if (!(box instanceof HTMLInputElement) || !(list instanceof HTMLElement)) return;

  const language: Language = document.documentElement.lang === 'en' ? 'en' : 'am';
  // Built once, on the first keystroke: a reader who never searches pays
  // nothing for the index.
  let index: Hit[] | null = null;
  let hits: Hit[] = [];
  let at = -1;

  const close = (): void => {
    list.hidden = true;
    list.textContent = '';
    box.setAttribute('aria-expanded', 'false');
    at = -1;
  };

  const paint = (): void => {
    list.textContent = '';
    hits.forEach((hit, i) => {
      const item = document.createElement('li');
      item.id = `find-hit-${i}`;
      item.role = 'option';
      item.ariaSelected = String(i === at);
      item.className = i === at ? 'on' : '';
      const title = document.createElement('strong');
      title.textContent = hit.title;
      const note = document.createElement('span');
      note.textContent = hit.note;
      item.append(title, note);
      item.addEventListener('mousedown', (event) => {
        // `mousedown`, not `click`: the box blurs first and would close the
        // list out from under the pointer.
        event.preventDefault();
        window.location.href = hit.href;
      });
      list.append(item);
    });
    list.hidden = hits.length === 0;
    box.setAttribute('aria-expanded', String(hits.length > 0));
    box.setAttribute('aria-activedescendant', at >= 0 ? `find-hit-${at}` : '');
  };

  box.addEventListener('input', () => {
    index ??= buildIndex(language);
    hits = search(index, box.value);
    at = hits.length > 0 ? 0 : -1;
    paint();
  });

  box.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      box.blur();
      return;
    }
    if (hits.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      at = (at + (event.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      paint();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = hits[at] ?? hits[0];
      if (hit !== undefined) window.location.href = hit.href;
    }
  });

  box.addEventListener('blur', () => {
    // After the click handler above has had its chance.
    window.setTimeout(close, 0);
  });
}
