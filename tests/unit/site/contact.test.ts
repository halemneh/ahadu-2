/**
 * The footer's two ways of getting word back (SITE.md §6).
 *
 * What is worth testing here is what cannot be seen by looking at the page.
 * A screenshot shows that the dialog opens; it does not show whether the
 * report link carries the page it was clicked from, whether the message a
 * reader typed in Ge'ez is measured in characters or in UTF-16 units, or
 * whether the email field is still optional after someone tidied the
 * validation.
 *
 * The last of those is the one with a person behind it: the site teaches
 * schoolchildren, and a typo report must never cost a child their email
 * address. A test is how that stays true.
 */

import { describe, expect, it } from 'vitest';
import {
  CONTACT_ENDPOINT,
  ISSUE_REPO,
  LIMITS,
  SITE_ORIGIN,
  contactDialog,
  footerActions,
  problemAttribute,
  reportIssueUrl,
  validateContact,
} from '../../../tools/site/build/contact.js';
import type { ContactProblem } from '../../../tools/site/build/contact.js';
import { LANGUAGES, strings } from '../../../tools/site/build/strings.js';
import type { Strings } from '../../../tools/site/build/strings.js';

const LESSON = '/am/ተማር/01-ሰላም/';

function body(url: string): string {
  const query = new URL(url).searchParams;
  return query.get('body') ?? '';
}

describe('the report-a-problem link', () => {
  it('opens a new issue on this repository', () => {
    const url = reportIssueUrl({ strings: strings('am'), url: LESSON });
    expect(url.startsWith(`${ISSUE_REPO}/issues/new?`)).toBe(true);
  });

  it('carries the page the reader was on', () => {
    // The whole point: a report that does not say which lesson is broken is
    // a report somebody has to answer with a question.
    expect(body(reportIssueUrl({ strings: strings('am'), url: LESSON }))).toContain(
      `${SITE_ORIGIN}${LESSON}`,
    );
  });

  it('carries the language, which the path does not always give away', () => {
    const am = body(reportIssueUrl({ strings: strings('am'), url: LESSON }));
    const en = body(reportIssueUrl({ strings: strings('en'), url: '/en/learn/01-hello/' }));
    expect(am).toContain('(am)');
    expect(am).toContain('አማርኛ');
    expect(en).toContain('(en)');
    expect(en).toContain('English');
  });

  it('says in the title which page it is about', () => {
    const title = new URL(
      reportIssueUrl({ strings: strings('en'), url: '/en/reference/' }),
    ).searchParams.get('title');
    expect(title).toContain('/en/reference/');
  });

  it('encodes the whole thing, Ge’ez and newlines included', () => {
    // This URL is written into static HTML. A raw space or newline in it is a
    // link that either breaks the attribute or arrives at GitHub truncated,
    // and neither failure is visible in a screenshot.
    const url = reportIssueUrl({ strings: strings('am'), url: LESSON });
    expect(url).not.toMatch(/\s/);
    expect(url).toMatch(/^[\x21-\x7e]+$/);
    // And it survives the round trip rather than merely looking encoded.
    expect(body(url)).toContain('ተማር');
  });

  it('asks the one question the reader has to answer themselves', () => {
    for (const language of ['am', 'en'] as const) {
      const s = strings(language);
      expect(body(reportIssueUrl({ strings: s, url: LESSON }))).toContain(s.issuePrompt);
    }
  });
});

describe('the footer’s actions', () => {
  const html = (language: 'am' | 'en'): string =>
    footerActions({ strings: strings(language), url: LESSON });

  it('reports a problem with a plain link, so JavaScript is not needed', () => {
    // A reader on a school machine with scripts off is exactly the reader most
    // likely to find a page that does not work.
    expect(html('am')).toContain(`<a class="foot-act" href="${ISSUE_REPO}/issues/new?`);
  });

  it('hides the contact button until the script has wired it up', () => {
    // The same reader must not be offered a button that cannot do anything.
    expect(html('en')).toMatch(/<button[^>]*id="contact-open"[^>]*hidden/);
  });

  it('still links to the source', () => {
    expect(html('en')).toContain(`href="${ISSUE_REPO}"`);
  });

  it('escapes the ampersand in the issue URL, which an attribute cannot hold raw', () => {
    expect(html('am')).toContain('&amp;body=');
  });
});

describe('the contact dialog’s markup', () => {
  const html = (language: 'am' | 'en'): string =>
    contactDialog({ strings: strings(language), url: LESSON });

  it('posts to the one endpoint the site knows about', () => {
    expect(html('am')).toContain(`data-endpoint="${CONTACT_ENDPOINT}"`);
  });

  it('is a dialog to anything reading the page aloud', () => {
    expect(html('am')).toContain('role="dialog"');
    expect(html('am')).toContain('aria-modal="true"');
    expect(html('am')).toContain('aria-labelledby="contact-title"');
  });

  it('says in the UI that the email field is optional, not only in the markup', () => {
    // `required` left off the input is invisible. A child looking at the form
    // has to be able to see that they may leave it empty.
    for (const language of ['am', 'en'] as const) {
      expect(html(language)).toContain(strings(language).contactEmailOptional);
    }
    expect(html('am')).not.toMatch(/<input id="contact-email"[^>]*required/);
    expect(html('am')).toMatch(/<textarea id="contact-message"[^>]*required/);
  });

  it('says what is collected, in the language of the page', () => {
    for (const language of ['am', 'en'] as const) {
      expect(html(language)).toContain(strings(language).contactPrivacy);
    }
  });

  it('carries a honeypot that no reader can reach', () => {
    const markup = html('en');
    expect(markup).toContain('id="contact-website"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toMatch(/class="trap" aria-hidden="true"/);
  });

  it('leaves room for Turnstile without loading it', () => {
    // A Turnstile script tag would be a third-party request on every page
    // view, which is the one thing SITE.md §6 does not allow. The element is
    // here; the script is not.
    const markup = html('am');
    expect(markup).toContain('id="contact-turnstile"');
    expect(markup).not.toContain('<script');
    expect(markup).not.toContain('challenges.cloudflare.com');
  });

  it('offers GitHub inside the dialog, for when the endpoint cannot be reached', () => {
    expect(html('am')).toContain(`${ISSUE_REPO}/issues/new?`);
  });

  it('has a message for every problem the validation can report', () => {
    // problemAttribute names a `data-` attribute, and the client reads it off
    // this element. A rename in one place and not the other would be a blank
    // error message, which is worse than none.
    const markup = html('am');
    const problems: ContactProblem[] = ['empty', 'too-long', 'bad-email', 'trap'];
    for (const problem of problems) {
      const attribute = problemAttribute(problem).replace(
        /[A-Z]/g,
        (upper) => `-${upper.toLowerCase()}`,
      );
      expect(markup, problem).toContain(`data-${attribute}="`);
    }
  });
});

describe('validating a submission', () => {
  const input = (
    over: Partial<Parameters<typeof validateContact>[0]> = {},
  ): Parameters<typeof validateContact>[0] => ({
    message: 'ትምህርት ሁለት ላይ ስተት አለ',
    email: '',
    trap: '',
    ...over,
  });

  it('accepts a message with no email address at all', () => {
    // The deliberate decision this whole feature turns on: the readers are
    // schoolchildren, and reporting a typo must not cost them an address.
    expect(validateContact(input())).toBeNull();
  });

  it('accepts a message with a reply address', () => {
    expect(validateContact(input({ email: 'teacher@example.com' }))).toBeNull();
  });

  it('refuses an empty message, and whitespace is empty', () => {
    expect(validateContact(input({ message: '' }))).toBe('empty');
    expect(validateContact(input({ message: '   \n  ' }))).toBe('empty');
  });

  it('measures the message in code points, not UTF-16 units', () => {
    // Ge'ez is outside the Latin block but still one unit per syllable; the
    // bug this guards against is a limit that halves for Amharic because a
    // string was measured with `.length` on something wider.
    expect(validateContact(input({ message: 'ሀ'.repeat(LIMITS.message) }))).toBeNull();
    expect(validateContact(input({ message: 'ሀ'.repeat(LIMITS.message + 1) }))).toBe('too-long');
  });

  it('catches an address that was meant to be one and is not', () => {
    expect(validateContact(input({ email: 'teacher' }))).toBe('bad-email');
    expect(validateContact(input({ email: 'teacher@example' }))).toBe('bad-email');
    expect(validateContact(input({ email: 'a b@example.com' }))).toBe('bad-email');
  });

  it('ignores the spaces around an address someone pasted', () => {
    expect(validateContact(input({ email: '  teacher@example.com  ' }))).toBeNull();
  });

  it('treats a blank-looking address as no address rather than a bad one', () => {
    expect(validateContact(input({ email: '   ' }))).toBeNull();
  });

  it('refuses an address longer than any address is allowed to be', () => {
    expect(validateContact(input({ email: `${'a'.repeat(LIMITS.email)}@example.com` }))).toBe(
      'bad-email',
    );
  });

  it('refuses anything that filled in the honeypot', () => {
    expect(validateContact(input({ trap: 'https://buy-things.example' }))).toBe('trap');
  });

  it('checks the honeypot before anything else', () => {
    // So a form filler is told nothing about what else was wrong with it.
    expect(validateContact(input({ message: '', trap: 'x' }))).toBe('trap');
  });

  it('tells a honeypot nothing, by answering it with the ordinary failure', () => {
    expect(problemAttribute('trap')).toBe('failed');
  });
});

describe('the contact strings', () => {
  /** The keys this feature added; the rest of the catalogue has its own test. */
  const added: (keyof Strings)[] = [
    'footerActions',
    'reportProblem',
    'issueTitle',
    'issueFieldPage',
    'issueFieldLanguage',
    'issueLanguageName',
    'issuePrompt',
    'contact',
    'contactTitle',
    'contactLead',
    'contactMessage',
    'contactEmail',
    'contactEmailOptional',
    'contactEmailHint',
    'contactPrivacy',
    'contactSend',
    'contactSending',
    'contactCancel',
    'contactSent',
    'contactFailed',
    'contactNeedMessage',
    'contactTooLong',
    'contactBadEmail',
  ];

  it('exists in both catalogues', () => {
    for (const key of added) {
      expect(LANGUAGES.am[key], `am.${key}`).toBeTruthy();
      expect(LANGUAGES.en[key], `en.${key}`).toBeTruthy();
    }
  });

  it('is written in Amharic in the Amharic catalogue', () => {
    // Amharic is the primary language, not a column waiting to be filled in.
    // A key that still holds its English text would read as an unfinished
    // translation on the default version of the site.
    for (const key of added) {
      expect(LANGUAGES.am[key], `am.${key}`).toMatch(/[ሀ-፿]/);
      expect(LANGUAGES.am[key], `am.${key}`).not.toBe(LANGUAGES.en[key]);
    }
  });
});
