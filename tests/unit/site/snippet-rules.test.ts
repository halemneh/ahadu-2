/**
 * The holes SITE.md §2's "every snippet is run" used to have.
 *
 * A fence the build does not see is a program nobody checked, published
 * under a page that says otherwise. Each case here used to render and pass.
 */

import { describe, expect, it } from 'vitest';
import { render } from '../../../tools/site/build/markdown.js';
import { strings } from '../../../tools/site/build/strings.js';
import { FN_ENTRIES } from '../../../tools/site/build/functions.js';
import { evaluate } from '../../../tools/playground/evaluate.js';
import { MAX_STEPS } from '../../../tools/site/build/snippet.js';

const view = (markdown: string): ReturnType<typeof render> =>
  render({ markdown, where: 'x.md', strings: strings('en'), base: '/en' });

/** A program that fails, so running it is what would catch it. */
const BROKEN = 'ጻፍ(ያልታወቀ)';

describe('fences the build cannot check are refused', () => {
  it('inside a list item', () => {
    expect(() => view(`- a step\n\n  \`\`\`ahadu\n  ${BROKEN}\n  \`\`\`\n`)).toThrow(
      /list or a quote/,
    );
  });

  it('inside a blockquote', () => {
    expect(() => view(`> \`\`\`ahadu\n> ${BROKEN}\n> \`\`\`\n`)).toThrow(/list or a quote/);
  });

  it('tagged with a capital letter', () => {
    expect(() => view(`\`\`\`Ahadu\n${BROKEN}\n\`\`\`\n`)).toThrow(/lowercase/);
  });

  it('an output fence after an error snippet', () => {
    expect(() =>
      view(`\`\`\`ahadu error=AH3001\n${BROKEN}\n\`\`\`\n\n\`\`\`output\nanything\n\`\`\`\n`),
    ).toThrow(/cannot also state an output/);
  });

  it('leaves other languages’ fences alone, wherever they are', () => {
    expect(() => view('- a step\n\n  ```sh\n  npm test\n  ```\n')).not.toThrow();
  });
});

describe('a `varies` snippet', () => {
  it('still runs, so it cannot crash', () => {
    expect(() => view(`\`\`\`ahadu varies\n${BROKEN}\n\`\`\`\n`)).toThrow(/meant to run/);
  });

  it('shows no build-time output and does not claim to be verified', () => {
    const { html } = view('```ahadu varies\nጻፍ(ዛሬ())\n```\n');
    expect(html).toContain('<pre class="snip-out" hidden>');
    expect(html).toContain(strings('en').snippetVaries);
    expect(html).not.toContain(strings('en').snippetVerified);
  });

  it('cannot also state its output', () => {
    expect(() => view('```ahadu varies\nጻፍ(1)\n```\n\n```output\n1\n```\n')).toThrow(/varies/);
  });
});

describe('a snippet that prints nothing', () => {
  it('carries the words the page shows when Run prints nothing', () => {
    expect(view('```ahadu\nሀ = 1\n```\n').html).toContain(`data-empty="${strings('en').noOutput}"`);
  });
});

describe('the reference’s examples', () => {
  // አንብብ's examples describe what was typed rather than print anything.
  const runnable = FN_ENTRIES.filter((entry) => !entry.eg.includes('አንብብ'));

  it('covers nearly every entry', () => {
    expect(runnable.length).toBeGreaterThan(FN_ENTRIES.length - 4);
  });

  for (const entry of runnable) {
    it(`${entry.sig} prints what its card says`, () => {
      const reply = evaluate({ source: entry.eg, input: [], maxSteps: MAX_STEPS });
      expect(reply.stoppedAt).toBeNull();
      expect(reply.output.trimEnd()).toBe(entry.out);
    });
  }
});
