/**
 * The site's build pipeline (SITE.md).
 *
 * The commitment these tests protect is §2: every snippet on the site is run
 * by the real interpreter, and a page that claims the wrong output fails the
 * build. That mechanism is worth testing precisely because it is the thing
 * standing between a beginner and a lesson that lies to them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseInfo, verify } from '../../../tools/site/build/snippet.js';
import type { Snippet } from '../../../tools/site/build/snippet.js';
import { parseFrontMatter, pairingProblems } from '../../../tools/site/build/content.js';
import type { SourcePage } from '../../../tools/site/build/content.js';
import { slug, render } from '../../../tools/site/build/markdown.js';
import { exampleName } from '../../../tools/site/build/examples.js';
import { errorTable, keywordTable } from '../../../tools/site/build/reference.js';
import { MESSAGES } from '../../../src/diagnostics.js';
import { LANGUAGES, otherLanguage, strings } from '../../../tools/site/build/strings.js';
import type { Strings } from '../../../tools/site/build/strings.js';

// verify() prints the detail before throwing, which would bury the output.
beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => void vi.restoreAllMocks());

function snippet(over: Partial<Snippet> = {}): Snippet {
  return {
    code: 'ጻፍ("ሰላም")',
    kind: 'program',
    expectedOutput: null,
    expectedCode: null,
    input: [],
    ...over,
  };
}

describe('fence flags', () => {
  it('reads a plain Ahadu fence as a whole program', () => {
    expect(parseInfo('ahadu')).toEqual({ kind: 'program', expectedCode: null });
  });

  it('reads the fragment flag', () => {
    expect(parseInfo('ahadu fragment').kind).toBe('fragment');
  });

  it('reads an expected error code', () => {
    expect(parseInfo('ahadu error=AH2008')).toEqual({ kind: 'error', expectedCode: 'AH2008' });
  });

  it('rejects a flag it does not know, rather than ignoring it', () => {
    // A typo that silently turned checking off is the one way this whole
    // mechanism could stop working without anyone noticing.
    expect(() => parseInfo('ahadu fragmnet')).toThrow(/unknown flag/);
    expect(() => parseInfo('ahadu error=oops')).toThrow(/unknown flag/);
    expect(() => parseInfo('ahadu error=AH20')).toThrow(/unknown flag/);
  });

  it('rejects a fence that is not Ahadu at all', () => {
    expect(() => parseInfo('python')).toThrow(/not an Ahadu fence/);
  });
});

describe('verifying a snippet', () => {
  it('accepts a program that runs and says nothing about its output', () => {
    expect(verify(snippet(), 'x.md').output).toBe('ሰላም\n');
  });

  it('accepts a program whose stated output is right', () => {
    expect(() => verify(snippet({ expectedOutput: 'ሰላም\n' }), 'x.md')).not.toThrow();
  });

  it('rejects a program whose stated output is wrong', () => {
    expect(() => verify(snippet({ expectedOutput: 'ሰላም ዓለም\n' }), 'x.md')).toThrow(
      /not what the page says/,
    );
  });

  it('rejects a program that was meant to run but fails', () => {
    expect(() => verify(snippet({ code: 'ጻፍ(ያልታወቀ)' }), 'x.md')).toThrow(/meant to run/);
  });

  it('names the file, so a failure can be found', () => {
    expect(() => verify(snippet({ expectedOutput: 'no' }), 'lessons/03.md')).toThrow(
      /lessons\/03\.md/,
    );
  });

  it('accepts a failing snippet that raises the code it claims', () => {
    const bad = snippet({ code: 'ጻፍ(10 / 0)', kind: 'error', expectedCode: 'AH3003' });
    const result = verify(bad, 'x.md');
    expect(result.failed).toBe(true);
    expect(result.output).toContain('AH3003');
  });

  it('rejects a failing snippet that raises a different code', () => {
    const bad = snippet({ code: 'ጻፍ(10 / 0)', kind: 'error', expectedCode: 'AH3001' });
    expect(() => verify(bad, 'x.md')).toThrow(/should raise AH3001 but raised AH3003/);
  });

  it('rejects a snippet marked as failing that runs cleanly', () => {
    const fine = snippet({ kind: 'error', expectedCode: 'AH3003' });
    expect(() => verify(fine, 'x.md')).toThrow(/ran cleanly/);
  });

  it('never runs a fragment, so an incomplete sample is allowed', () => {
    expect(() =>
      verify(snippet({ code: 'ዕድሜ > 18 ከሆነ፦', kind: 'fragment' }), 'x.md'),
    ).not.toThrow();
  });

  it('serves input to አንብብ', () => {
    const asks = snippet({ code: 'ጻፍ(አንብብ())', input: ['ዓለም'] });
    expect(verify(asks, 'x.md').output).toBe('ዓለም\n');
  });
});

describe('rendering a page', () => {
  const view = (markdown: string): ReturnType<typeof render> =>
    render({ markdown, where: 'x.md', strings: strings('en'), base: '/en' });

  it('turns an Ahadu fence into an editable, runnable snippet', () => {
    const out = view('```ahadu\nጻፍ("ሰላም")\n```\n');
    expect(out.snippets).toBe(1);
    expect(out.html).toContain('class="snip"');
    expect(out.html).toContain('snip-input');
    expect(out.html).toContain('snip-run');
  });

  it('pairs an output fence with the snippet above it and shows it once', () => {
    // `marked` puts a space token between blocks; a lookahead that does not
    // skip it leaves the output to render as a second code block, and the
    // page then prints the answer twice.
    const out = view('```ahadu\nጻፍ("ሰላም")\n```\n\n```ውጤት\nሰላም\n```\n');
    expect(out.snippets).toBe(1);
    // Three: the painted backdrop, the textarea that holds the real source,
    // and the output panel. A fourth would mean the ውጤት fence had also been
    // rendered as a code block of its own.
    expect(out.html.match(/ሰላም/g)?.length).toBe(3);
    expect(out.html).not.toContain('language-ውጤት');
    expect(out.html.match(/snip-out/g)?.length).toBe(1);
  });

  it('checks that paired output against the real interpreter', () => {
    expect(() => view('```ahadu\nጻፍ("ሰላም")\n```\n\n```ውጤት\nየተሳሳተ\n```\n')).toThrow(
      /not what the page says/,
    );
  });

  it('highlights a fragment without running it', () => {
    const out = view('```ahadu fragment\nዕድሜ > 18 ከሆነ፦\n```\n');
    expect(out.html).toContain('snip-fragment');
    expect(out.html).not.toContain('snip-run');
  });

  it('colours code with the lexer’s own tokens, not a second description', () => {
    const out = view('```ahadu\nዕድሜ = 20\nዕድሜ > 18 ከሆነ፦\n    ጻፍ("ሀ")\n```\n');
    expect(out.html).toContain('tk-kw'); // ከሆነ, from KEYWORDS
    expect(out.html).toContain('tk-num');
    expect(out.html).toContain('tk-str');
  });

  it('collects headings for the contents list', () => {
    const out = view('## First\n\ntext\n\n## Second\n\ntext\n');
    expect(out.headings.map((h) => h.text)).toEqual(['First', 'Second']);
    expect(out.html).toContain('<h2 id="first">');
  });

  it('leaves ordinary Markdown alone', () => {
    expect(view('A **bold** word.\n').html).toContain('<strong>bold</strong>');
  });
});

describe('heading anchors', () => {
  it('keeps Ge’ez, rather than transliterating it', () => {
    expect(slug('ሁኔታው ቀድሞ ይመጣል')).toBe('ሁኔታው-ቀድሞ-ይመጣል');
  });

  it('drops the punctuation that would break a fragment', () => {
    expect(slug('ለምን አሃዱ?')).toBe('ለምን-አሃዱ');
    expect(slug('ጻፍ፣ ጽሑፍ')).toBe('ጻፍ-ጽሑፍ');
  });

  it('lowercases Latin headings', () => {
    expect(slug('Your First Program')).toBe('your-first-program');
  });
});

describe('front matter', () => {
  const good = '---\nid: hello\ntitle: ሰላም\nsummary: የመጀመሪያው\norder: 10\n---\n\nbody here\n';

  it('reads the fields and returns the body', () => {
    const { meta, body } = parseFrontMatter(good, 'x.md');
    expect(meta).toEqual({ id: 'hello', title: 'ሰላም', summary: 'የመጀመሪያው', order: 10 });
    expect(body.trim()).toBe('body here');
  });

  it('refuses a file with none', () => {
    expect(() => parseFrontMatter('# just a heading\n', 'x.md')).toThrow(/no front matter/);
  });

  it('refuses a missing field rather than rendering a blank heading', () => {
    expect(() => parseFrontMatter('---\nid: a\ntitle: b\norder: 1\n---\n', 'x.md')).toThrow(
      /needs summary/,
    );
  });
});

describe('the two languages describing the same site', () => {
  const page = (over: Partial<SourcePage>): SourcePage => ({
    id: 'hello',
    title: 't',
    summary: 's',
    order: 1,
    language: 'am',
    section: 'learn',
    slug: 'x',
    markdown: '',
    file: 'f.md',
    ...over,
  });

  it('is happy when every id appears in both', () => {
    expect(pairingProblems([page({})], [page({ language: 'en' })])).toEqual([]);
  });

  it('reports a page with no translation', () => {
    expect(pairingProblems([page({})], [])).toEqual([
      expect.stringContaining('no English page with id "hello"'),
    ]);
    expect(pairingProblems([], [page({ language: 'en' })])).toEqual([
      expect.stringContaining('no Amharic page with id "hello"'),
    ]);
  });

  it('reports a page that moved section in one language only', () => {
    const problems = pairingProblems([page({})], [page({ language: 'en', section: 'reference' })]);
    expect(problems[0]).toContain('learn');
    expect(problems[0]).toContain('reference');
  });

  it('reports every problem at once, not the first', () => {
    const problems = pairingProblems([page({ id: 'a' }), page({ id: 'b' })], []);
    expect(problems).toHaveLength(2);
  });
});

describe('the site’s own chrome', () => {
  it('defines the same keys in both languages', () => {
    expect(Object.keys(LANGUAGES.en).sort()).toEqual(Object.keys(LANGUAGES.am).sort());
  });

  it('leaves nothing empty', () => {
    for (const [name, catalogue] of Object.entries(LANGUAGES)) {
      for (const [key, value] of Object.entries(catalogue)) {
        expect(String(value).length, `${name}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives each language its own URL segments, so neither reads the other’s', () => {
    expect(strings('am').pathLearn).toBe('ተማር');
    expect(strings('en').pathLearn).toBe('learn');
  });

  it('offers the other language to switch to', () => {
    expect(otherLanguage('am')).toBe('en');
    expect(otherLanguage('en')).toBe('am');
  });

  it('names itself, so the switch says where it goes', () => {
    expect(strings('am').languageToggle).toBe('English');
    expect(strings('en').languageToggle).toBe('አማርኛ');
  });

  it('keeps the same shape of value for every key', () => {
    for (const key of Object.keys(LANGUAGES.am) as (keyof Strings)[]) {
      expect(typeof LANGUAGES.en[key], key).toBe(typeof LANGUAGES.am[key]);
    }
  });
});

describe('example names', () => {
  it('drops the ordering prefix and the extension', () => {
    expect(exampleName('01-ሰላም.ahadu')).toBe('ሰላም');
  });

  it('turns dashes into spaces', () => {
    expect(exampleName('07-ጽሁፍ-እና-ስብስብ.ahadu')).toBe('ጽሁፍ እና ስብስብ');
  });
});

describe('the generated reference', () => {
  it('has a meaning for every keyword the lexer knows', () => {
    // Guards against a new keyword showing up in the reference as its internal
    // type name — `func`, `init` — in a page meant for a beginner.
    expect(() => keywordTable(strings('am'))).not.toThrow();
    expect(() => keywordTable(strings('en'))).not.toThrow();
  });

  it('groups the spellings that mean the same word', () => {
    // ከሆነ, ከሖነ and ከኆነ are one keyword; three rows would make them look
    // like three different things.
    const table = keywordTable(strings('en'));
    const row =
      /<tr><td class="ref-word">([^<]*(?:<code>[^<]*<\/code>\s*)+)<\/td><td>if<\/td>/.exec(table);
    expect(row?.[0]).toContain('ከሆነ');
    expect(row?.[0]).toContain('ከሖነ');
  });

  it('lists every error code the interpreter can raise', () => {
    const table = errorTable(strings('am'));
    for (const code of Object.keys(MESSAGES)) {
      expect(table, code).toContain(code);
    }
  });

  it('puts each code under the stage its number promises', () => {
    const table = errorTable(strings('en'));
    const lexical = table.indexOf('Lexical errors');
    const runtime = table.indexOf('Runtime errors');
    expect(lexical).toBeLessThan(runtime);
    expect(table.indexOf('AH1001')).toBeGreaterThan(lexical);
    expect(table.indexOf('AH1001')).toBeLessThan(runtime);
    expect(table.indexOf('AH3001')).toBeGreaterThan(runtime);
  });
});
