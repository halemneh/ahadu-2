/**
 * The footer's two ways of getting word back (SITE.md §6).
 *
 * The site sends nothing on its own, and that does not change here: both of
 * these are things the reader decides to do, and neither makes a request until
 * they do.
 *
 * **Report a problem** is a link, built here at generate time, carrying the
 * page and its language to a pre-filled GitHub issue. A link rather than a
 * form because a broken lesson should become a tracked issue with no typing
 * and no JavaScript — the readers most likely to find a mistake are the ones
 * least likely to be on a device where a script ran.
 *
 * **Contact** is a form, for the reader with something to say who has no
 * GitHub account, which is nearly all of them. It posts to a small Worker
 * (`tools/contact-worker/`) and nothing about it touches the page until the
 * reader presses Send.
 *
 * The limits and the validation live here rather than in the client, because
 * the page and the browser must agree on what counts as a message. The Worker
 * keeps its own copy of them: it is deployed separately and cannot import
 * this, and a server that trusts the client's checks has no checks.
 */

import { escapeHtml } from '../../playground/view.js';
import type { Strings } from './strings.js';

/**
 * Where the contact form posts. The one place to change it.
 *
 * A build-time constant rather than anything read at run time: the page is
 * static, and a configurable endpoint in a static site is a string in the
 * HTML either way — this way it is a string in the repository too.
 */
export const CONTACT_ENDPOINT = 'https://contact.ahaducode.com/';

/** The repository the issue link opens an issue on. */
export const ISSUE_REPO = 'https://github.com/halemneh/ahadu-2';

/** Where the site is served, so a report carries a URL and not just a path. */
export const SITE_ORIGIN = 'https://ahaducode.com';

/**
 * What the form accepts, in code points.
 *
 * The message limit is generous enough for a long explanation and small
 * enough that the Worker cannot be used to post a book. 254 is the longest
 * address RFC 5321 allows.
 */
export const LIMITS = { message: 4000, email: 254 } as const;

/** Why a submission was refused, or `null` if it is fine to send. */
export type ContactProblem = 'empty' | 'too-long' | 'bad-email' | 'trap';

export interface ContactInput {
  readonly message: string;
  readonly email: string;
  /**
   * The honeypot. A field no person sees and no person fills in; anything in
   * it came from something filling in every input it found.
   */
  readonly trap: string;
}

/*
 * Deliberately loose. The point of checking an address at all is to catch a
 * reader who meant to leave a reply address and mistyped it — a stricter
 * pattern would reject real addresses, and the field is optional anyway, so
 * the cost of a false rejection is a reader who gets no answer.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: ContactInput): ContactProblem | null {
  if (input.trap.trim() !== '') return 'trap';
  if (input.message.trim() === '') return 'empty';
  // Code points, not UTF-16 units: a message in Ge'ez is not twice as long
  // as the same message in Latin.
  if ([...input.message].length > LIMITS.message) return 'too-long';

  const email = input.email.trim();
  if (email === '') return null;
  if ([...email].length > LIMITS.email) return 'bad-email';
  return LOOKS_LIKE_EMAIL.test(email) ? null : 'bad-email';
}

/**
 * Which of the dialog's messages answers a problem.
 *
 * The dialog carries its messages as `data-` attributes, already in the
 * language of the page it is on, so the browser needs no second copy of the
 * catalogue. This is the one mapping from a problem to the attribute that
 * explains it, and it is shared by the markup below and the client.
 */
export function problemAttribute(problem: ContactProblem): string {
  switch (problem) {
    case 'empty':
      return 'needMessage';
    case 'too-long':
      return 'tooLong';
    case 'bad-email':
      return 'badEmail';
    case 'trap':
      // The honeypot gets the ordinary failure message on purpose: whatever
      // filled the field learns nothing from it, and a person can only reach
      // it by typing into an input that is not on the page.
      return 'failed';
  }
}

export interface ReportTarget {
  readonly strings: Strings;
  /** The page's own URL, absolute from the site root. */
  readonly url: string;
}

/**
 * A GitHub issue with the context already in it.
 *
 * Built at generate time, so the href in the HTML is complete and the link
 * works with JavaScript switched off. The reader arrives at GitHub's new-issue
 * form with the page and its language filled in and only the one question left
 * to answer, which is the difference between a report and an intention to
 * report.
 */
export function reportIssueUrl(target: ReportTarget): string {
  const s = target.strings;
  const title = `${s.issueTitle}: ${target.url}`;
  const body = [
    `${s.issueFieldPage}: ${SITE_ORIGIN}${target.url}`,
    `${s.issueFieldLanguage}: ${s.issueLanguageName} (${s.code})`,
    '',
    s.issuePrompt,
    '',
  ].join('\n');

  return (
    `${ISSUE_REPO}/issues/new` +
    `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
  );
}

/**
 * The footer's actions: the report link, the contact button, the source.
 *
 * The button arrives `hidden` and the client script unhides it. A reader with
 * JavaScript off would otherwise be offered a button that cannot do anything,
 * while the two things beside it — a link and a link — still work.
 */
export function footerActions(target: ReportTarget): string {
  const s = target.strings;
  return `<nav class="foot-acts" aria-label="${escapeHtml(s.footerActions)}">
        <a class="foot-act" href="${escapeHtml(reportIssueUrl(target))}">${escapeHtml(
          s.reportProblem,
        )}</a>
        <button class="foot-act" type="button" id="contact-open" hidden>${escapeHtml(
          s.contact,
        )}</button>
        <a class="foot-act" href="${ISSUE_REPO}">GitHub</a>
      </nav>`;
}

/**
 * The contact dialog.
 *
 * Markup only — it is inert until `client/main.ts` wires it up, and it is in
 * every page's HTML because a static site has nowhere else to put it.
 *
 * It follows the playground's input dialog (`tools/playground/index.html`,
 * `#ask`): `role="dialog"`, `aria-modal`, labelled by its own heading, closed
 * by Escape or a click outside. Its messages are carried as `data-` attributes
 * so the script says things in the language of the page it is on without a
 * second copy of the catalogue reaching the browser.
 */
export function contactDialog(target: ReportTarget): string {
  const s = target.strings;
  return `<div id="contact" class="modal" hidden
      data-endpoint="${escapeHtml(CONTACT_ENDPOINT)}"
      data-sending="${escapeHtml(s.contactSending)}"
      data-sent="${escapeHtml(s.contactSent)}"
      data-failed="${escapeHtml(s.contactFailed)}"
      data-need-message="${escapeHtml(s.contactNeedMessage)}"
      data-too-long="${escapeHtml(s.contactTooLong)}"
      data-bad-email="${escapeHtml(s.contactBadEmail)}">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <h2 id="contact-title">${escapeHtml(s.contactTitle)}</h2>
        <p class="modal-why">${escapeHtml(s.contactLead)}</p>

        <form id="contact-form" novalidate>
          <label class="field" for="contact-message">
            <span>${escapeHtml(s.contactMessage)}</span>
          </label>
          <textarea id="contact-message" name="message" required spellcheck="false"
            maxlength="${LIMITS.message}"></textarea>

          <label class="field" for="contact-email">
            <span>${escapeHtml(s.contactEmail)}</span>
            <em>${escapeHtml(s.contactEmailOptional)}</em>
          </label>
          <input id="contact-email" name="email" type="email" autocomplete="email"
            maxlength="${LIMITS.email}" placeholder="${escapeHtml(s.contactEmailHint)}" />

          <!--
            The honeypot. Hidden from sight and from screen readers, and left
            out of the tab order, so nothing that reads this page the way a
            person does will ever put anything in it.
          -->
          <div class="trap" aria-hidden="true">
            <label for="contact-website">Website</label>
            <input id="contact-website" name="website" type="text" tabindex="-1"
              autocomplete="off" />
          </div>

          <!--
            Turnstile goes here when the honeypot stops being enough: render
            the widget into this element and send the token it writes into
            \`cf-turnstile-response\` as \`token\` in the POST body (the Worker
            already looks for it and will verify it against Cloudflare).

            Its script is deliberately NOT in this page. Loading it would be a
            request to a third party on every page view, which is the one thing
            SITE.md §6 does not allow — so it is added at the moment the
            dialog is first opened, from the client, or not at all.
          -->
          <div id="contact-turnstile"></div>

          <p class="modal-note">${escapeHtml(s.contactPrivacy)}</p>

          <p id="contact-status" class="modal-status" role="status" tabindex="-1" hidden></p>
          <p id="contact-fallback" class="modal-note" hidden>
            <a href="${escapeHtml(reportIssueUrl(target))}">${escapeHtml(s.reportProblem)}</a>
          </p>

          <div class="modal-actions">
            <button id="contact-cancel" class="foot-act" type="button">${escapeHtml(
              s.contactCancel,
            )}</button>
            <button id="contact-send" class="button" type="submit">${escapeHtml(
              s.contactSend,
            )}</button>
          </div>
        </form>
      </div>
    </div>`;
}
