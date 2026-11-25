/**
 * The theme tokens (SITE.md §5.1).
 *
 * There are two light themes in the stylesheet — the one a reader gets by
 * pressing the toggle, and the one they get from `prefers-color-scheme` when
 * they never have. They must hold the same values, and they had silently
 * stopped: the fallback still carried the palette from two revisions back, so
 * the colours a visitor saw depended on whether they had ever touched the
 * theme control. Nothing failed, because nothing compared them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(resolve(root, 'tools/shared/tokens.css'), 'utf8');

/** Every `--name: value` declared inside one block of the stylesheet. */
function declarations(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of source.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
    out[name as string] = (value as string).trim();
  }
  return out;
}

/** The text between a selector and the brace that closes it. */
function block(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, selector).toBeGreaterThan(-1);
  const from = css.indexOf('{', at) + 1;
  let depth = 1;
  let i = from;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(from, i - 1);
}

const dark = declarations(block(":root[data-theme='dark']"));
const light = declarations(block(":root[data-theme='light']"));
const fallback = declarations(block(":root:not([data-theme='dark'])"));

describe('the two light themes agree', () => {
  it('the fallback declares exactly what the toggle does', () => {
    expect(Object.keys(fallback).sort()).toEqual(Object.keys(light).sort());
  });

  it('with the same value for every one of them', () => {
    for (const [name, value] of Object.entries(light)) {
      expect(fallback[name], name).toBe(value);
    }
  });
});

/** The font stacks are declared once, in `:root`: type does not change theme. */
const FONTS = new Set(['--ui', '--code']);
const colours = (t: Record<string, string>): string[] =>
  Object.keys(t).filter((k) => !FONTS.has(k));

describe('the dark theme is complete', () => {
  it('declares every colour the light one does', () => {
    // A colour defined only in light inherits the dark value through `:root`,
    // which is how something meant for a pale page ends up on a dark one.
    expect(colours(light).sort()).toEqual(colours(dark).sort());
  });

  it('gives the two themes different values, not the same ones twice', () => {
    const shared = Object.keys(dark).filter((k) => dark[k] === light[k]);
    // Some are deliberately shared — the cards keep their fill in both themes.
    expect(shared.sort()).toEqual(
      ['--card-aqua', '--card-aqua-ink', '--card-dark', '--card-dark-ink'].sort(),
    );
  });
});

describe('every colour token is a resolvable value', () => {
  it('names a hex colour, an rgb() or another token', () => {
    for (const [name, value] of Object.entries({ ...dark, ...light })) {
      if (FONTS.has(name)) continue;
      expect(value, `${name}: ${value}`).toMatch(
        /^(#[0-9a-f]{3,8}|rgb\(|var\(--|0 |[0-9]|ui-|system-)/i,
      );
    }
  });
});
