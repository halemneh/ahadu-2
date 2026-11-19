/**
 * What the playground's panels show (TOOLING.md §2).
 *
 * The page's logic lives in `view.ts` precisely so it can be checked here,
 * without a browser: `main.ts` is left as glue that puts these strings into
 * elements.
 */

import { describe, expect, it } from 'vitest';
import {
  analyse,
  astRowsHtml,
  diagnosticHtml,
  diagnosticsHtml,
  escapeHtml,
  exampleName,
  outputHtml,
  statusOf,
  tokenRowsHtml,
} from '../../../tools/playground/view.js';
import { diagnostic } from '../../../src/diagnostics.js';
import { strings } from '../../../tools/playground/strings.js';
import type { RunReply } from '../../../tools/playground/evaluate.js';

const am = strings('am');

/** Extracts the data-* attributes of every row, which is what highlighting uses. */
function regions(html: string): string[] {
  return [
    ...html.matchAll(
      /data-line="(\d+)" data-start="(\d+)" data-end-line="(\d+)" data-end="(\d+)"/g,
    ),
  ].map((m) => `${m[1]}:${m[2]}-${m[3]}:${m[4]}`);
}

describe('analyse (§9.3)', () => {
  it('reports tokens, diagnostics and tree rows together', () => {
    const result = analyse('ሀ = 1');
    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('still produces a tree for a half-typed program', () => {
    // This is what the parser's error recovery is for: the panels stay useful.
    const result = analyse('ቆጣሪ = 0\nቆጣሪ < 5 እስከሆነ ድረስ፦\n    ጻፍ(ቆ');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeGreaterThan(1);
    expect(result.rows[0]?.text).toContain('Program');
  });

  it('collects lexer and parser diagnostics together', () => {
    // The panel shows everything each stage found, unlike a runner, which
    // stops at the first stage that reports (§9.3).
    //
    // The middle one is the cost of that: with the `$` skipped, the stream
    // reads `ሀ = 1 2`, so the leftover 2 is a real parse error — derived from
    // the lexical one rather than independent of it. An editor would rather
    // have it than nothing; a runner would rather stop.
    const result = analyse('ሀ = 1 $ 2\nለ < ሐ < መ');
    expect(result.diagnostics.map((d) => d.code)).toEqual(['AH1001', 'AH2001', 'AH2008']);
  });

  it('handles empty source', () => {
    const result = analyse('');
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.map((t) => t.type)).toEqual(['EOF']);
  });
});

describe('the tokens panel (§2.1)', () => {
  it('shows one row per token, with span, kind and value', () => {
    const html = tokenRowsHtml(analyse('ሀ = 1').tokens, am);
    expect(html).toContain('IDENTIFIER');
    expect(html).toContain('ASSIGN');
    expect(html).toContain('NUMBER');
    expect(html).toContain('>1<');
  });

  it('gives each row the span it covers, for highlighting', () => {
    expect(regions(tokenRowsHtml(analyse('ሀ = 1').tokens, am))[0]).toBe('1:1-1:1');
  });

  it('marks a የ-prefixed name with its stem', () => {
    expect(tokenRowsHtml(analyse('የሃይሌ ዕድሜ').tokens, am)).toContain('(የ + ሃይሌ)');
  });

  it('says so when there is nothing to show', () => {
    expect(tokenRowsHtml([], am)).toContain('ምንም ቶከን የለም');
  });

  it('escapes a token value rather than letting it become markup', () => {
    const html = tokenRowsHtml(analyse('ሀ = "<b>"').tokens, am);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('the AST panel (§2.1)', () => {
  it('shows the tree', () => {
    const html = astRowsHtml(analyse('1 + 2').rows, am);
    expect(html).toContain('Program');
    expect(html).toContain('BinaryExpression ADD');
  });

  it('gives each node row the span it covers', () => {
    const html = astRowsHtml(analyse('ሀ = 1').rows, am);
    expect(regions(html).length).toBeGreaterThan(1);
  });

  it('gives a group header no span, since it stands for no node', () => {
    const html = astRowsHtml(analyse('ጻፍ(1፣ 2)').rows, am);
    expect(html).toContain('args:');
    // The `args:` row itself carries no data-line.
    const headerRow = html.split('</span>').find((part) => part.includes('args:'));
    expect(headerRow).not.toContain('data-line');
  });

  it('spans several lines for a multi-line construct', () => {
    const html = astRowsHtml(analyse('ተግባር ሀ()፦\n    ተመላሽ 1').rows, am);
    expect(regions(html).some((r) => /^1:1-2:/.test(r))).toBe(true);
  });

  it('says so when there is nothing to show', () => {
    expect(astRowsHtml([], am)).toContain('ምንም ዛፍ የለም');
  });
});

describe('the errors panel (§1.3)', () => {
  const d = diagnostic('AH3003', 'runtime', 2, 5, 9, 'በዘሮ ማካፈል አይቻልም።');

  it('always carries the code, so it can be quoted', () => {
    expect(diagnosticHtml('ሀ = 1\nጻፍ(ሀ / 0)', d, am)).toContain('[AH3003]');
  });

  it('shows the message, the position and the source line', () => {
    const html = diagnosticHtml('ሀ = 1\nጻፍ(ሀ / 0)', d, am);
    expect(html).toContain('በዘሮ');
    expect(html).toContain('መስመር 2 ላይ');
    expect(html).toContain('ጻፍ(ሀ / 0)');
  });

  it('carries the span so hovering it highlights the source', () => {
    expect(regions(diagnosticHtml('ሀ\nጻፍ(ሀ / 0)', d, am))).toEqual(['2:5-2:9']);
  });

  it('includes a traceback when the error was inside a call', () => {
    const html = diagnosticHtml('ሀ', d, am, [
      { name: 'ዋና ፕሮግራም', line: 4 },
      { name: 'ሀ', line: 2 },
    ]);
    expect(html).toContain('class="frames"');
    expect(html).toContain('ዋና ፕሮግራም');
    expect(html).toContain('↓');
  });

  it('leaves the traceback out otherwise', () => {
    expect(diagnosticHtml('ሀ', d, am)).not.toContain('class="frames"');
  });

  it('says so when a program is clean', () => {
    expect(diagnosticsHtml('ሀ = 1', [], am)).toContain('ምንም ስተት አልተገኘም');
  });

  it('survives a line number past the end of the source', () => {
    const beyond = diagnostic('AH2001', 'parser', 99, 1, 1, 'x');
    expect(() => diagnosticHtml('ሀ', beyond, am)).not.toThrow();
  });
});

describe('the output panel (§2.1)', () => {
  const clean: RunReply = {
    output: '',
    diagnostics: [],
    frames: [],
    value: null,
    stoppedAt: null,
  };

  it('shows what the program printed', () => {
    expect(outputHtml({ ...clean, output: 'ሰላም\n' }, am)).toBe('ሰላም');
  });

  it('shows the value of the last statement after the output', () => {
    const html = outputHtml({ ...clean, output: 'ሀ\n', value: '42' }, am);
    expect(html).toContain('ሀ');
    expect(html).toContain('ዋጋ፦ 42');
  });

  it('shows nothing extra when the last statement produced ምንም', () => {
    expect(outputHtml({ ...clean, output: 'ሀ\n' }, am)).not.toContain('ዋጋ፦');
  });

  it('says so when a program printed nothing at all', () => {
    expect(outputHtml(clean, am)).toContain('ምንም ውጤት የለም');
  });

  it('shows the error that stopped the program, after its output', () => {
    const html = outputHtml(
      {
        ...clean,
        output: 'አንድ\n',
        diagnostics: [diagnostic('AH3003', 'runtime', 2, 1, 5, 'በዘሮ ማካፈል አይቻልም።')],
        stoppedAt: 'runtime',
      },
      am,
    );
    expect(html).toContain('አንድ');
    expect(html).toContain('[AH3003]');
  });

  it('escapes program output rather than letting it become markup', () => {
    const html = outputHtml({ ...clean, output: '<img onerror=x>\n' }, am);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('status and names', () => {
  it('is good when there is nothing wrong', () => {
    expect(statusOf([], am)).toEqual({ text: 'ምንም ስተት የለም', state: 'good' });
  });

  it('counts the problems otherwise', () => {
    const d = diagnostic('AH2001', 'parser', 1, 1, 1, 'x');
    expect(statusOf([d, d], am)).toEqual({ text: '2 ስተት', state: 'bad' });
  });

  it('names an example by its file name', () => {
    expect(exampleName('../../examples/03-ቤተሰብ.ahadu')).toBe('03-ቤተሰብ');
  });
});

describe('escapeHtml', () => {
  it('handles the three characters that matter', () => {
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
  });

  it('leaves Amharic alone', () => {
    expect(escapeHtml('ሰላም ዓለም')).toBe('ሰላም ዓለም');
  });
});
