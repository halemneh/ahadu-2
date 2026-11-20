/**
 * Carrying a program in a URL (tools/shared/share.ts).
 *
 * A lesson's "open in playground" link puts the snippet in the fragment. The
 * encoder runs at build time in Node and the decoder runs in the browser, so
 * the two never meet — which is exactly why they are one module and why this
 * exercises both ends against each other.
 */

import { describe, expect, it } from 'vitest';
import { decodeProgram, encodeProgram } from '../../../tools/shared/share.js';

describe('a program in a URL fragment', () => {
  it.each([
    ['ጻፍ("ሰላም ዓለም!")'],
    ['ዕድሜ = 20\n\nዕድሜ > 18 ከሆነ፦\n    ጻፍ("ትልቅ ሰው")'],
    ['# አስተያየት፣ በ"ጥቅስ" ውስጥ ልዩ ምልክቶች / + = ?'],
    ['ቁጥሮች = [1፣ 2፣ 3]'],
    [''],
    ['\n\n'],
    ['\u{1F600} astral'],
  ])('survives the round trip: %j', (source) => {
    const back = decodeProgram(encodeProgram(source));
    // An empty program decodes as null: there is nothing to carry.
    expect(back ?? '').toBe(source);
  });

  it('produces something safe to put after a #', () => {
    const encoded = encodeProgram('ዕድሜ > 18 ከሆነ፦\n    ጻፍ("ሀ/ለ")');
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('is shorter than percent-encoding, which matters for Ge’ez', () => {
    // Every Ethiopic code point is three UTF-8 bytes, so percent-encoding
    // would be nine characters each; base64 is four per three bytes.
    const source = 'ጻፍ("ሰላም ዓለም")';
    expect(encodeProgram(source).length).toBeLessThan(encodeURIComponent(source).length);
  });

  it('accepts the fragment with its leading hash, as location.hash gives it', () => {
    const encoded = encodeProgram('ጻፍ("ሰላም")');
    expect(decodeProgram(`#${encoded}`)).toBe('ጻፍ("ሰላም")');
  });

  it('returns null for an empty fragment', () => {
    expect(decodeProgram('')).toBeNull();
    expect(decodeProgram('#')).toBeNull();
  });

  it('returns null rather than throwing on a hand-edited fragment', () => {
    // The fragment is the one part of a URL people retype. An unreadable one
    // should leave the playground as it was, not break the page.
    expect(decodeProgram('#not base64 at all!!')).toBeNull();
    expect(decodeProgram('#////')).toBeNull();
  });

  it('rejects bytes that are not valid UTF-8, rather than showing U+FFFD', () => {
    // Half-decoded Ge'ez reads as a bug in the language, not a bad link.
    expect(decodeProgram('#_____w')).toBeNull();
  });
});
