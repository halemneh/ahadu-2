/** Colour (TOOLING.md §1) and the shared diagnostic renderer (§1.3). */

import { afterEach, describe, expect, it } from 'vitest';
import { env } from 'node:process';
import { colorEnabled, palette } from '../../../src/cli/color.js';
import { renderDiagnostic, sourceFrame, traceback } from '../../../src/cli/report.js';
import { diagnostic } from '../../../src/diagnostics.js';

const plain = palette(false);
const colored = palette(true);

afterEach(() => {
  delete env.NO_COLOR;
});

describe('when colour is used', () => {
  it('is off for a stream that is not a terminal', () => {
    expect(colorEnabled({ isTTY: false })).toBe(false);
    expect(colorEnabled({})).toBe(false);
  });

  it('is on for a terminal', () => {
    expect(colorEnabled({ isTTY: true })).toBe(true);
  });

  it('is off when --no-color was passed', () => {
    expect(colorEnabled({ isTTY: true }, false)).toBe(false);
  });

  it('is off when NO_COLOR is set to anything, including nothing', () => {
    // The convention is that any value at all means no colour.
    env.NO_COLOR = '1';
    expect(colorEnabled({ isTTY: true })).toBe(false);
    env.NO_COLOR = '';
    expect(colorEnabled({ isTTY: true })).toBe(false);
  });
});

describe('the palette', () => {
  it('leaves text alone when disabled', () => {
    expect(plain.error('ሀ')).toBe('ሀ');
    expect(plain.dim('ሀ')).toBe('ሀ');
    expect(plain.caret('^')).toBe('^');
    expect(plain.bold('ሀ')).toBe('ሀ');
    expect(plain.prompt('>')).toBe('>');
  });

  it('wraps text in escapes when enabled, and closes them', () => {
    expect(colored.error('ሀ')).toContain('ሀ');
    expect(colored.error('ሀ')).toMatch(/^\u001B\[.+m/);
    expect(colored.error('ሀ')).toMatch(/\u001B\[0m$/);
  });
});

describe('the source frame (§9.1)', () => {
  const d = diagnostic('AH3003', 'runtime', 2, 5, 9, 'በዘሮ ማካፈል አይቻልም።');
  const source = 'ሀ = 1\nጻፍ(ሀ / 0)';

  it('shows the offending line with its number', () => {
    expect(sourceFrame(source, d, plain)).toContain('2:');
    expect(sourceFrame(source, d, plain)).toContain('ጻፍ(ሀ / 0)');
  });

  it('puts a caret under each column of the span', () => {
    expect(sourceFrame(source, d, plain)).toContain('^^^^^');
  });

  it('draws at least one caret for a zero-width span', () => {
    const point = diagnostic('AH2001', 'parser', 1, 3, 3, 'x');
    expect(sourceFrame('ሀ = 1', point, plain)).toContain('^');
  });

  it('survives a line number past the end of the source', () => {
    const beyond = diagnostic('AH2001', 'parser', 99, 1, 1, 'x');
    expect(() => sourceFrame('ሀ', beyond, plain)).not.toThrow();
  });
});

describe('the traceback (§9.1)', () => {
  it('is empty for an error outside any call', () => {
    expect(traceback([{ name: 'ዋና ፕሮግራም', line: 1 }], plain)).toBe('');
    expect(traceback([], plain)).toBe('');
  });

  it('lists frames outermost first, each at its line', () => {
    const text = traceback(
      [
        { name: 'ዋና ፕሮግራም', line: 7 },
        { name: 'ውጪ', line: 5 },
        { name: 'ውስጥ', line: 2 },
      ],
      plain,
    );
    const names = text.split('\n').filter((line) => line.includes('መስመር'));
    expect(names).toHaveLength(3);
    expect(names[0]).toContain('ዋና ፕሮግራም');
    expect(names[2]).toContain('ውስጥ');
    expect(text).toContain('የጥሪ መልሶ ምልከታ');
  });

  it('indents each call below the one that made it', () => {
    const text = traceback(
      [
        { name: 'ሀ', line: 1 },
        { name: 'ለ', line: 2 },
      ],
      plain,
    );
    expect(text).toContain('↓');
  });
});

describe('a rendered diagnostic (§1.3)', () => {
  const d = diagnostic('AH3001', 'runtime', 1, 1, 3, '"ሀለሐ" የሚባል ተለዋጭ አልተገለጸም።');

  it('always carries its code, so it can be quoted', () => {
    expect(renderDiagnostic('ሀለሐ', d, plain)).toContain('[AH3001]');
  });

  it('carries the Amharic message, line and column', () => {
    const text = renderDiagnostic('ሀለሐ', d, plain);
    expect(text).toContain('አልተገለጸም');
    expect(text).toContain('መስመር 1 ላይ');
    expect(text).toContain('1ኛው ካራክተር');
  });

  it('includes a traceback when there is one', () => {
    const text = renderDiagnostic('ሀለሐ', d, plain, [
      { name: 'ዋና ፕሮግራም', line: 1 },
      { name: 'ሀ', line: 1 },
    ]);
    expect(text).toContain('የጥሪ መልሶ ምልከታ');
  });

  it('leaves the traceback out when the error was not in a call', () => {
    expect(renderDiagnostic('ሀለሐ', d, plain)).not.toContain('የጥሪ መልሶ ምልከታ');
  });
});
