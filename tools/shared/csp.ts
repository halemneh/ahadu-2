/**
 * The Content Security Policy every page carries (SITE.md §6.1).
 *
 * The site is served from GitHub Pages, which sends no headers a project can
 * set, so the policy travels in the page as a `<meta http-equiv>`. That is
 * enough for the part that matters: **nothing may be loaded from anywhere but
 * the site itself**, and the one place a page may send anything is the
 * contact endpoint. It turns SITE.md §6.1's "nothing is requested on page
 * load" from a promise into something the browser enforces — including
 * against a script added by something between the site and the reader, such
 * as a CDN's analytics injected into every page.
 *
 * Scripts are the site's own files plus one inline script per page, the
 * pre-paint theme switch, allowed by its hash. `style-src` allows inline
 * styles because Vite's dev server injects stylesheets as `<style>` elements;
 * a style cannot run code, and scripts are where the protection is.
 *
 * Two things a `<meta>` policy cannot do, and which need real headers if the
 * site moves to a host that allows them: `frame-ancestors` (refusing to be
 * framed) is ignored in a meta tag, and so is `report-uri`.
 */

/** Where the contact form posts. Mirrors CONTACT_ENDPOINT in site/build/contact.ts. */
export const CONTACT_ORIGIN = 'https://contact.ahaducode.com';

/** The policy, given the `sha256-…` source of each inline script on the page. */
export function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.map((hash) => `'${hash}'`).join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${CONTACT_ORIGIN}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}
