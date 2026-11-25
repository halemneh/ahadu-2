/**
 * The playground's editor highlighting (TOOLING.md §2).
 *
 * The point of these: the colours come from the lexer's own token spans, so
 * what the editor shows is by construction what Ahadu read. A keyword variant
 * the lexer accepts cannot fail to light up, and something it rejects cannot
 * pretend to be a keyword.
 */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../src/lexer/index.js';
import { parse } from '../../../src/parser/index.js';
import { highlight } from '../../../tools/playground/highlight.js';

/** Highlights a source the way the page does. */
function paint(source: string, extra: Partial<Parameters<typeof highlight>[0]> = {}): string {
  const lexed = tokenize(source);
  return highlight({
    source,
    tokens: lexed.tokens,
    diagnostics: lexed.diagnostics,
    ...extra,
  });
}

/** The text content of the HTML, with every tag stripped. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

describe('the highlighted text is the source, exactly', () => {
  it.each([
    'ሀ = 1',
    'ጻፍ("ሰላም")',
    'ዕድሜ > 18 ከሆነ፦\n    ጻፍ("ትልቅ")',
    '# አስተያየት\nሀ = 1',
    '',
    '\n\n',
    'ሀ = 1\n\nለ = 2',
    'ሀ < ለ && ሐ',
    '[1፣ 2፣ 3][0:2]',
  ])('round-trips %o', (source) => {
    expect(textOf(paint(source))).toBe(source);
  });

  it('escapes HTML so source can never become markup', () => {
    const html = paint('ሀ = "<script>" + \'&\'');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(textOf(html)).toBe('ሀ = "<script>" + \'&\'');
  });

  it('emits one line per source line, so the backdrop cannot drift', () => {
    // A blank line in the middle is where a mismatched line count shows up.
    expect(paint('ሀ\n\nለ').split('\n')).toHaveLength(3);
    expect(paint('ሀ\nለ\nሐ').split('\n')).toHaveLength(3);
  });
});

describe('colours come from the lexer', () => {
  it('marks keywords', () => {
    expect(paint('ከሆነ')).toContain('class="tk-kw"');
  });

  it('marks every spelling variant the lexer accepts', () => {
    for (const spelling of ['ከሆነ', 'ከሖነ', 'ከኆነ', 'ሐሠት', 'ዕውነት']) {
      expect(paint(spelling), spelling).toContain('tk-');
    }
  });

  it('gives type keywords their own colour', () => {
    expect(paint('ቁጥር ሀ = 1')).toContain('class="tk-type"');
  });

  it('marks boolean and ምንም literals', () => {
    expect(paint('እውነት')).toContain('class="tk-lit"');
    expect(paint('ምንም')).toContain('class="tk-lit"');
  });

  it('marks a reserved word distinctly, since it is not usable yet', () => {
    expect(paint('አቁም')).toContain('class="tk-reserved"');
  });

  it('marks numbers, including Ge’ez numerals', () => {
    expect(paint('42')).toContain('class="tk-num"');
    expect(paint('፳፩')).toContain('class="tk-num"');
  });

  it('marks strings', () => {
    expect(paint('"ሰላም"')).toContain('class="tk-str"');
  });

  it('does not colour a word that only looks like a keyword', () => {
    // ከሆነነገር is one identifier, not ከሆነ followed by ነገር (§3.2).
    expect(paint('ከሆነነገር')).not.toContain('tk-kw');
    expect(paint('ከሆነነገር')).toContain('class="tk-id"');
  });

  it('marks the two-word while keyword across the space it contains', () => {
    const html = paint('እስከሆነ ድረስ');
    expect(html).toContain('class="tk-kw"');
    // One run, not two, because it is one token.
    expect(html.match(/class="tk-kw"/g)).toHaveLength(1);
  });
});

describe('Ahadu’s Ethiopic marks are told apart from each other', () => {
  it('paints ፦ as the block opener it is', () => {
    expect(paint('ዕድሜ > 18 ከሆነ፦')).toContain('class="tk-then"');
  });

  it('paints ። as the end of a statement', () => {
    expect(paint('ሀ = 1።')).toContain('class="tk-stop"');
  });

  it('paints ፣ as a separator', () => {
    expect(paint('ጻፍ("ሀ"፣ "ለ")')).toContain('class="tk-sep"');
  });

  it('leaves the ASCII , the same colour as the Ethiopic ፣', () => {
    // They are one token type; a reader who types either should see no
    // difference, because the language sees none.
    expect(paint('ጻፍ("ሀ", "ለ")')).toContain('class="tk-sep"');
  });

  it('keeps a slice’s : quiet, since it is not structure', () => {
    expect(paint('ዝ[1:2]')).toContain('class="tk-punct"');
  });
});

describe('brackets are coloured by how deeply they nest', () => {
  it('gives the outermost pair the first depth', () => {
    const html = paint('ጻፍ("ሀ")');
    expect(html).toContain('tk-br0');
    expect(html).not.toContain('tk-br1');
  });

  it('steps the colour inwards and back out again', () => {
    const html = paint('ጻፍ(ድምር(ሀ፣ ለ))');
    expect(html).toContain('tk-br0');
    expect(html).toContain('tk-br1');
    // The two closers come back out through the same two depths.
    expect(html.match(/tk-br0/g)).toHaveLength(2);
    expect(html.match(/tk-br1/g)).toHaveLength(2);
  });

  it('counts ( and [ on one depth, as the lexer does', () => {
    // A ( inside a [ is one level deeper, not a second first level.
    const html = paint('ዝ[ድምር(1፣ 2)]');
    expect(html).toContain('tk-br0');
    expect(html).toContain('tk-br1');
  });

  it('cycles after three levels rather than running out', () => {
    const html = paint('ሀ((((1))))');
    expect(html).toContain('tk-br0');
    expect(html).toContain('tk-br1');
    expect(html).toContain('tk-br2');
    // The fourth level is back to the first colour: two openers, two closers.
    expect(html.match(/tk-br0/g)).toHaveLength(4);
  });

  it('does not throw on a stray closer, which a fragment may have', () => {
    expect(() => paint('ሀ)')).not.toThrow();
    expect(paint('ሀ)')).toContain('tk-br0');
  });
});

describe('the bracket beside the caret lights up its partner', () => {
  // `caret` is a UTF-16 offset, exactly what textarea.selectionStart gives.
  const source = 'ጻፍ("ሀ")';

  it('marks both brackets when the caret is just before the opener', () => {
    const html = paint(source, { caret: source.indexOf('(') });
    expect(html.match(/tk-match/g)).toHaveLength(2);
  });

  it('marks them when the caret is just after the closer', () => {
    const html = paint(source, { caret: source.length });
    expect(html.match(/tk-match/g)).toHaveLength(2);
  });

  it('marks nothing when the caret is not beside a bracket', () => {
    expect(paint(source, { caret: 1 })).not.toContain('tk-match');
  });

  it('marks nothing when there is no caret at all', () => {
    expect(paint(source)).not.toContain('tk-match');
  });

  it('matches the inner pair rather than the outer one', () => {
    const nested = 'ጻፍ(ድምር(1))';
    const html = paint(nested, { caret: nested.lastIndexOf('(') });
    expect(html.match(/tk-match/g)).toHaveLength(2);
    expect(html).toContain('tk-br1 tk-match');
  });

  it('keeps the depth colour under the match, which is a wash not a repaint', () => {
    const html = paint(source, { caret: source.indexOf('(') });
    expect(html).toContain('tk-br0 tk-match');
  });

  it('leaves an unmatched bracket alone', () => {
    expect(paint('ሀ(', { caret: 2 })).not.toContain('tk-match');
  });

  it('counts the caret in UTF-16 units, as the DOM does', () => {
    // Ge'ez is one UTF-16 unit per syllable, so a mix-up only shows with a
    // character outside the BMP — here an emoji inside a string.
    const withPair = 'ጻፍ("😀")';
    const html = paint(withPair, { caret: withPair.length });
    expect(html.match(/tk-match/g)).toHaveLength(2);
  });
});

describe('comments, which produce no tokens at all', () => {
  it('colours a whole-line comment', () => {
    expect(paint('# አስተያየት')).toContain('class="tk-comment"');
  });

  it('colours a trailing comment', () => {
    const html = paint('ሀ = 1 # አስተያየት');
    expect(html).toContain('class="tk-comment"');
    expect(html).toContain('class="tk-num"');
  });

  it('does not mistake a # inside a string for one', () => {
    // The lexer already claimed those columns for the STRING token.
    expect(paint('"ሀ # ለ"')).not.toContain('tk-comment');
  });

  it('colours a comment on its own line among code', () => {
    const html = paint('ሀ = 1\n# አስተያየት\nለ = 2');
    expect(html.split('\n')[1]).toContain('tk-comment');
  });
});

describe('diagnostics underline their span (§2.2)', () => {
  it('marks the columns a lexical error covers', () => {
    expect(paint('ሀ $ ለ')).toContain('tk-bad');
  });

  it('marks a parse error’s span', () => {
    const source = 'ሀ < ለ < ሐ';
    const lexed = tokenize(source);
    const html = highlight({
      source,
      tokens: lexed.tokens,
      diagnostics: parse(lexed.tokens).diagnostics,
    });
    expect(html).toContain('tk-bad');
  });

  it('leaves clean source unmarked', () => {
    expect(paint('ሀ = 1')).not.toContain('tk-bad');
  });

  it('survives a diagnostic pointing past the end of a line', () => {
    // A missing token is reported one column past the last character.
    const source = 'ዕድሜ > 18 ከሆነ';
    const lexed = tokenize(source);
    expect(() =>
      highlight({ source, tokens: lexed.tokens, diagnostics: parse(lexed.tokens).diagnostics }),
    ).not.toThrow();
  });
});

describe('a hovered region lights up its source (§2.1)', () => {
  it('marks a single-line region', () => {
    const html = paint('ሀ = 1', { hovered: { line: 1, startCol: 1, endCol: 1 } });
    expect(html).toContain('tk-hot');
  });

  it('marks every line of a region that spans several', () => {
    const source = 'ዕድሜ > 18 ከሆነ፦\n    ጻፍ("ሀ")\n    ጻፍ("ለ")';
    const html = paint(source, {
      hovered: { line: 1, startCol: 1, endLine: 3, endCol: 11 },
    });
    const lines = html.split('\n');
    expect(lines[0]).toContain('tk-hot');
    expect(lines[1]).toContain('tk-hot');
    expect(lines[2]).toContain('tk-hot');
  });

  it('ignores a region outside the source', () => {
    expect(() => paint('ሀ', { hovered: { line: 99, startCol: 1, endCol: 5 } })).not.toThrow();
  });

  it('combines with a token colour rather than replacing it', () => {
    const html = paint('ከሆነ', { hovered: { line: 1, startCol: 1, endCol: 3 } });
    expect(html).toContain('tk-kw');
    expect(html).toContain('tk-hot');
  });
});

describe('every example highlights without loss', () => {
  it.each(['01-ሰላም', '03-ቤተሰብ', '05-ክላስ', '07-ጽሁፍ-እና-ስብስብ'])('%s', async (name) => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const source = readFileSync(resolve(root, `examples/${name}.ahadu`), 'utf8');

    const html = paint(source);
    expect(textOf(html)).toBe(source);
    expect(html).not.toContain('tk-bad');
  });
});
