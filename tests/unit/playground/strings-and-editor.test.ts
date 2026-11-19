/**
 * The playground's two languages (TOOLING.md §2) and the editor's furniture:
 * line numbers and the position readout.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, otherLanguage, strings } from '../../../tools/playground/strings.js';
import type { Strings } from '../../../tools/playground/strings.js';
import {
  analyse,
  cursorPosition,
  diagnosticHtml,
  gutterHtml,
  lineNumbers,
  needsInput,
  positionLabel,
  statusOf,
} from '../../../tools/playground/view.js';
import { diagnostic } from '../../../src/diagnostics.js';

const am = strings('am');
const en = strings('en');

describe('the two catalogues agree in shape', () => {
  it('has both languages', () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual(['am', 'en']);
  });

  it('defines exactly the same keys in each', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(am).sort());
  });

  it('leaves nothing empty or undefined', () => {
    for (const [name, catalogue] of Object.entries(LANGUAGES)) {
      for (const [key, value] of Object.entries(catalogue)) {
        if (typeof value === 'function') continue;
        expect(value, `${name}.${key}`).toBeTypeOf('string');
        expect(String(value).length, `${name}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives the same keys the same kind of value in each', () => {
    for (const key of Object.keys(am) as (keyof Strings)[]) {
      expect(typeof en[key], key).toBe(typeof am[key]);
    }
  });

  it('offers the other language to switch to', () => {
    expect(otherLanguage('am')).toBe('en');
    expect(otherLanguage('en')).toBe('am');
  });

  it('names itself, so the toggle can say where it goes', () => {
    expect(am.languageToggle).toBe('English');
    expect(en.languageToggle).toBe('አማርኛ');
  });
});

describe('what each language changes', () => {
  it('translates the chrome', () => {
    expect(am.tabOutput).toBe('ውጤት');
    expect(en.tabOutput).toBe('Output');
    expect(am.run).toContain('አሂድ');
    expect(en.run).toContain('Run');
  });

  it('counts errors the way each language does', () => {
    const d = diagnostic('AH2001', 'parser', 1, 1, 1, 'x');
    expect(statusOf([d], am).text).toBe('1 ስተት');
    expect(statusOf([d], en).text).toBe('1 error');
    expect(statusOf([d, d], en).text).toBe('2 errors');
  });

  it('translates the position line around a diagnostic', () => {
    const d = diagnostic('AH3001', 'runtime', 3, 7, 9, 'ያልታወቀ ተለዋጭ');
    expect(diagnosticHtml({ source: 'ሀ\nለ\nሐ', strings: am }, { diagnostic: d })).toContain(
      'መስመር 3 ላይ',
    );
    expect(diagnosticHtml({ source: 'ሀ\nለ\nሐ', strings: en }, { diagnostic: d })).toContain(
      'line 3, column 7',
    );
  });

  it('leaves the interpreter’s own message alone in both', () => {
    // The Amharic in a diagnostic is the language, not the page: LANGUAGE.md
    // §9 makes it normative, so neither catalogue restates it.
    const d = diagnostic('AH3001', 'runtime', 1, 1, 3, 'ያልታወቀ ተለዋጭ');
    expect(diagnosticHtml({ source: 'ሀለሐ', strings: am }, { diagnostic: d })).toContain(
      'ያልታወቀ ተለዋጭ',
    );
    expect(diagnosticHtml({ source: 'ሀለሐ', strings: en }, { diagnostic: d })).toContain(
      'ያልታወቀ ተለዋጭ',
    );
  });

  it('keeps the code visible in both, since it is language-neutral', () => {
    const d = diagnostic('AH3001', 'runtime', 1, 1, 1, 'ያልታወቀ ተለዋጭ');
    const badge = 'class="code">AH3001<';
    expect(diagnosticHtml({ source: 'ሀ', strings: am }, { diagnostic: d })).toContain(badge);
    expect(diagnosticHtml({ source: 'ሀ', strings: en }, { diagnostic: d })).toContain(badge);
  });

  it('translates a traceback frame', () => {
    const d = diagnostic('AH3003', 'runtime', 2, 1, 1, 'በዘሮ ማካፈል አይቻልም።');
    const frames = [
      { name: 'ዋና ፕሮግራም', line: 4 },
      { name: 'አካፍል', line: 2 },
    ];
    expect(
      diagnosticHtml({ source: 'ሀ\nለ', strings: am }, { diagnostic: d, frames: frames }),
    ).toContain('መስመር 4 ላይ ዋና ፕሮግራም');
    expect(
      diagnosticHtml({ source: 'ሀ\nለ', strings: en }, { diagnostic: d, frames: frames }),
    ).toContain('line 4 in ዋና ፕሮግራም');
  });
});

describe('line numbers', () => {
  it.each([
    ['', [1]],
    ['ሀ', [1]],
    ['ሀ\nለ', [1, 2]],
    ['ሀ\n\nሐ', [1, 2, 3]],
    ['ሀ\n', [1, 2]],
  ])('numbers %o as %o', (source, want) => {
    expect(lineNumbers(source)).toEqual(want);
  });

  it('renders one per line, so the gutter matches the text', () => {
    expect(gutterHtml('ሀ\nለ\nሐ')).toBe('1\n2\n3');
  });

  it('counts a long line once, since the editor does not wrap', () => {
    // Wrapping would put one logical line on several rows, and the gutter
    // would drift; styles.css uses `pre` for exactly this reason.
    expect(lineNumbers('ሀ'.repeat(500))).toEqual([1]);
  });
});

describe('the cursor position readout', () => {
  it.each([
    ['ሀ = 1', 0, 1, 1],
    ['ሀ = 1', 1, 1, 2],
    ['ሀ = 1', 5, 1, 6],
    ['ሀ\nለ', 2, 2, 1],
    ['ሀ\nለሐመ', 5, 2, 4],
    ['ሀ\n\nሐ', 3, 3, 1],
  ])('%o at offset %i is line %i, column %i', (source, offset, line, column) => {
    expect(cursorPosition(source, offset)).toEqual({ line, column });
  });

  it('counts columns in code points, so it agrees with the diagnostics', () => {
    // An astral character is one code point and two UTF-16 units. Counting
    // units would put the readout one ahead of every error on the line.
    const source = '\u{1F600}ሀ';
    expect(cursorPosition(source, 2).column).toBe(2);
    expect(cursorPosition(source, 3).column).toBe(3);
  });

  it('starts at 1:1 for an empty document', () => {
    expect(cursorPosition('', 0)).toEqual({ line: 1, column: 1 });
  });

  it('survives an offset past the end', () => {
    expect(cursorPosition('ሀ', 99)).toEqual({ line: 1, column: 2 });
  });

  it('survives a negative offset', () => {
    expect(cursorPosition('ሀ', -5)).toEqual({ line: 1, column: 1 });
  });
});

describe('the readout label', () => {
  it('shows the position in each language', () => {
    expect(positionLabel('ሀ = 1', 2, 2, am)).toBe('መስመር 1፣ ዓምድ 3');
    expect(positionLabel('ሀ = 1', 2, 2, en)).toBe('Ln 1, Col 3');
  });

  it('adds a count when text is selected', () => {
    expect(positionLabel('ሀለሐ', 0, 3, en)).toContain('3 selected');
    expect(positionLabel('ሀለሐ', 0, 3, am)).toContain('3 ተመርጧል');
  });

  it('counts a selection in code points too', () => {
    expect(positionLabel('\u{1F600}\u{1F600}', 0, 4, en)).toContain('2 selected');
  });

  it('shows no count when nothing is selected', () => {
    expect(positionLabel('ሀ', 1, 1, en)).toBe('Ln 1, Col 2');
  });
});

describe('deciding whether to ask for input', () => {
  // The dialog opens before the run, so the question is answered from the
  // tokens rather than from the running program; see view.ts for why.
  function needs(source: string): boolean {
    return needsInput(analyse(source).tokens);
  }

  it('asks when the program calls አንብብ', () => {
    expect(needs('ስም = አንብብ("ስም፦ ")')).toBe(true);
  });

  it('does not ask when it never reads', () => {
    expect(needs('ጻፍ("ሰላም")')).toBe(false);
    expect(needs('')).toBe(false);
  });

  it('asks for a call anywhere, not just the first line', () => {
    expect(needs('ሀ = 1\nለ = 2\nሐ = አንብብ()')).toBe(true);
  });

  it('asks even inside a block, where a scan of statements would miss it', () => {
    expect(needs('ሀ > 1 ከሆነ፦\n  ስም = አንብብ()')).toBe(true);
  });

  it('ignores the word inside a string or a comment, which is not a call', () => {
    expect(needs('ጻፍ("አንብብ")')).toBe(false);
    expect(needs('# አንብብ ይጠቀማል\nጻፍ("ሰላም")')).toBe(false);
  });

  it('still asks when the source does not parse, since tokens are enough', () => {
    expect(needs('ሀ = $ አንብብ(')).toBe(true);
  });
});
