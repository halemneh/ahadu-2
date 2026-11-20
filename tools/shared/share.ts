/**
 * Carrying a program in a URL.
 *
 * A lesson's "open in playground" link puts the snippet in the fragment, so
 * the playground opens holding that program. One module for both ends, because
 * an encoder and a decoder that disagree fail silently: the link opens, the
 * editor just has the wrong thing in it.
 *
 * The fragment, not the query string: a fragment is never sent to a server.
 * The playground promises that nothing goes anywhere (TOOLING.md §2), and a
 * program in a query string would be in someone's access log.
 *
 * Base64url of the UTF-8 bytes. Ge'ez is multi-byte, so percent-encoding would
 * triple the length of every program, and raw base64's `+` and `/` are not
 * safe in a fragment.
 */

/** Encodes a program for a URL fragment. */
export function encodeProgram(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Reads one back, or null.
 *
 * Null rather than a throw, for anything that is not a program this encoded:
 * a fragment is the one part of a URL people edit by hand, and an unreadable
 * one should leave the playground as it was rather than break the page.
 */
export function decodeProgram(fragment: string): string | null {
  const trimmed = fragment.replace(/^#/, '');
  if (trimmed === '') return null;

  try {
    const padded = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    // `fatal` so invalid UTF-8 is rejected rather than turned into U+FFFD —
    // half-decoded Ge'ez looks like a bug in the language, not a bad link.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
