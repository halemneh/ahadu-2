/**
 * The header's navigation drawer, on a narrow screen.
 *
 * Five sections, a brand, a language switch and a theme switch do not fit
 * across a phone, and flex-wrap turned the header into three stacked rows —
 * a third of a 390px screen spent on chrome before the reader saw a word of
 * the lesson. Below 760px the sections move into a drawer and the header
 * stays one row.
 *
 * Two rules the drawer keeps:
 *
 * - **It needs no JavaScript to be survivable.** The button is `hidden` in
 *   the markup and unhidden here, and the drawer styles are scoped to the
 *   `js` class the page sets before first paint. With scripting off the nav
 *   is the plain wrapped list it always was — two lines of links, which is a
 *   worse header and a working site. The reverse (a hamburger that cannot
 *   open) would be no site at all.
 * - **It is a dialog, so it behaves like one.** Focus moves in on open and
 *   back to the button on close, Escape closes it, Tab stays inside it, and
 *   a tap on the page behind closes it. Without the focus trap a reader on a
 *   keyboard tabs off the drawer into a page they cannot see.
 *
 * Shared by the site's pages and the playground, which wear the same header
 * (TOOLING.md §2.1).
 */

/** The width below which the sections live in the drawer. Matches chrome.css. */
const NARROW = '(max-width: 760px)';

/** Everything inside the drawer a reader can reach with the keyboard. */
function stops(within: HTMLElement, toggle: HTMLElement): HTMLElement[] {
  const found = within.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
  // The toggle is outside the drawer but is part of it: closing has to be
  // reachable without leaving, and it is the natural last stop.
  return [...found, toggle];
}

export function setUpMenu(): void {
  const bar = document.querySelector('.sitebar');
  const toggle = document.getElementById('menu');
  const nav = document.getElementById('sitenav');
  const scrim = document.getElementById('nav-scrim');

  if (
    !(bar instanceof HTMLElement) ||
    !(toggle instanceof HTMLButtonElement) ||
    !(nav instanceof HTMLElement) ||
    !(scrim instanceof HTMLElement)
  ) {
    return;
  }

  toggle.hidden = false;
  bar.dataset.nav = 'closed';

  const isOpen = (): boolean => bar.dataset.nav === 'open';

  const open = (): void => {
    bar.dataset.nav = 'open';
    toggle.setAttribute('aria-expanded', 'true');
    scrim.hidden = false;
    /*
     * Reading a layout property forces the style change above to be applied
     * before focus moves. Until it is, the engine still has the drawer as
     * `visibility: hidden`, `focus()` on anything inside it is ignored, and
     * the reader is left on the button with no sign the drawer opened.
     *
     * A `requestAnimationFrame` does not do instead: its callback runs
     * *before* style and layout for that frame, so the stale value is still
     * there. This is also why the drawer's `visibility` is switched with a
     * delay rather than interpolated (chrome.css) — a transition would keep
     * it un-focusable for the whole slide however hard this flushed.
     */
    void nav.offsetWidth;
    nav.querySelector('a')?.focus();
  };

  /**
   * `returnFocus` is false when the drawer closes because the window grew
   * past the breakpoint: nothing the reader did asked for focus to move, and
   * yanking it to a button that has just become invisible is worse than
   * leaving it where it was.
   */
  const close = (returnFocus = true): void => {
    if (!isOpen()) return;
    bar.dataset.nav = 'closed';
    toggle.setAttribute('aria-expanded', 'false');
    scrim.hidden = true;
    if (returnFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    if (isOpen()) close();
    else open();
  });

  scrim.addEventListener('click', () => {
    close();
  });

  // A link navigates, but not when it points at the page already open: that
  // one would leave the drawer across a reload that never happens.
  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) close(false);
  });

  /*
   * On the document rather than on the drawer. Focus can leave on its own —
   * a click on the scrim puts it on the body — and Escape has to keep
   * working from wherever it landed.
   */
  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;

    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const order = stops(nav, toggle);
    const first = order[0];
    const last = order[order.length - 1];
    if (first === undefined || last === undefined) return;

    const here = order.find((stop) => stop === document.activeElement) ?? null;
    if (here === null) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && here === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && here === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Rotating a phone, or dragging a desktop window wider, leaves the drawer
  // open over a header that no longer has a button to shut it.
  window.matchMedia(NARROW).addEventListener('change', (event) => {
    if (!event.matches) close(false);
  });
}
