/**
 * The contact dialog, shared by every page that has a footer.
 *
 * It lived in the site's own client, so the playground — which does not load
 * that file — had a footer with no way to get in touch, while every other
 * page had one. The footer is shared; what the footer opens has to be too.
 *
 * Nothing here runs until a reader presses the button, and nothing is sent
 * until they press Send (SITE.md §6).
 */

import { problemAttribute, validateContact } from '../site/build/contact.js';

/** Everything inside the dialog a reader can reach with the keyboard. */
function focusable(within: HTMLElement): HTMLElement[] {
  const all = within.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
  );
  return [...all].filter((element) => element.offsetParent !== null);
}

/**
 * The footer's contact form.
 *
 * Follows the playground's input dialog (`tools/playground/main.ts`, `#ask`):
 * focus moves in on open, Escape and a click on the backdrop close it. Two
 * things this one adds, because this dialog can be opened by anyone reading
 * any page rather than only mid-run: Tab is kept inside it, and focus goes
 * back to the button that opened it on the way out.
 *
 * Nothing here runs until the reader asks for it, and nothing is sent until
 * they press Send.
 */
export function setUpContact(): void {
  const modal = document.getElementById('contact');
  const opener = document.getElementById('contact-open');
  const form = document.getElementById('contact-form');
  const message = document.getElementById('contact-message');
  const email = document.getElementById('contact-email');
  const trap = document.getElementById('contact-website');
  const status = document.getElementById('contact-status');
  const fallback = document.getElementById('contact-fallback');
  const send = document.getElementById('contact-send');
  const cancel = document.getElementById('contact-cancel');

  if (
    !(modal instanceof HTMLElement) ||
    !(opener instanceof HTMLButtonElement) ||
    !(form instanceof HTMLFormElement) ||
    !(message instanceof HTMLTextAreaElement) ||
    !(email instanceof HTMLInputElement) ||
    !(trap instanceof HTMLInputElement) ||
    !(status instanceof HTMLElement) ||
    !(fallback instanceof HTMLElement) ||
    !(send instanceof HTMLButtonElement) ||
    !(cancel instanceof HTMLButtonElement)
  ) {
    return;
  }

  // The button is hidden in the HTML. A reader with no JavaScript is not
  // offered a control that cannot do anything; the report link beside it is a
  // plain link and works for them.
  opener.hidden = false;

  const say = (text: string, bad: boolean): void => {
    status.hidden = false;
    status.textContent = text;
    status.classList.toggle('modal-status-bad', bad);
  };

  const open = (): void => {
    modal.hidden = false;
    message.focus();
  };

  const close = (): void => {
    modal.hidden = true;
    // Back where they were, rather than at the top of the document.
    opener.focus();
  };

  opener.addEventListener('click', open);
  cancel.addEventListener('click', close);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  /*
   * On the document rather than on the dialog, because a key is only
   * delivered to the dialog while something inside it has focus — and focus
   * can leave on its own: disabling the Send button while a message is in
   * flight drops it on the body, and Escape then did nothing. The smoke test
   * caught exactly that.
   */
  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return;

    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    // Keep Tab inside the dialog: behind it is a whole page of links that a
    // reader using the keyboard would otherwise walk into without being able
    // to see where they had gone.
    const stops = focusable(modal);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first === undefined || last === undefined) return;

    const here = stops.find((stop) => stop === document.activeElement) ?? null;
    if (here === null) {
      // Focus is somewhere outside the dialog's own stops. Bring it back
      // rather than letting Tab walk off into the page underneath.
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const problem = validateContact({
      message: message.value,
      email: email.value,
      trap: trap.value,
    });
    if (problem !== null) {
      say(modal.dataset[problemAttribute(problem)] ?? '', true);
      if (problem === 'bad-email') email.focus();
      else if (problem !== 'trap') message.focus();
      return;
    }

    fallback.hidden = true;
    say(modal.dataset.sending ?? '', false);
    // Focus moves to the line that says what is happening before the button
    // goes away under it: a disabled button cannot hold focus, and a reader
    // who cannot see the screen would otherwise be told nothing.
    status.focus();
    send.disabled = true;

    /*
     * Turnstile, when the honeypot stops being enough: read the token the
     * widget writes into the hidden `cf-turnstile-response` input and add it
     * to this body as `token`. The Worker already forwards a `token` to
     * Cloudflare's siteverify when it is given one.
     *
     * Its script must not be a `<script>` tag in the page: that would be a
     * third-party request on every page view, which SITE.md §6 forbids. It
     * belongs in `open()` above, injected the first time the dialog is
     * opened, so it is fetched only by a reader who has decided to write to
     * us — or by nobody at all.
     */
    void fetch(modal.dataset.endpoint ?? '', {
      method: 'POST',
      // A connection that drops packets — ordinary for part of this audience
      // (SITE.md §6.1) — never answers at all, and left the button disabled
      // on "Sending…" for good. After this long it fails like any other
      // failure: the text is kept and GitHub is offered.
      ...(typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(20_000) } : {}),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: message.value,
        email: email.value.trim(),
        website: trap.value,
        // Context, so a report about a lesson says which lesson.
        path: window.location.pathname,
        language: document.documentElement.lang,
      }),
    })
      .then((reply) => {
        if (!reply.ok) throw new Error(`the endpoint answered ${reply.status}`);
        say(modal.dataset.sent ?? '', false);
        // Sent, so it is safe to empty — and leaving it would invite a reader
        // to press Send twice.
        message.value = '';
        email.value = '';
      })
      .catch(() => {
        /*
         * The endpoint may simply not be reachable: some of the readers this
         * site is for are behind connections that block a good deal. So the
         * message stays in the textarea — they can try again, or take the
         * GitHub link now shown beneath, which needs nothing of ours.
         */
        say(modal.dataset.failed ?? '', true);
        fallback.hidden = false;
      })
      .finally(() => {
        send.disabled = false;
      });
  });
}
