/**
 * Every page's Content Security Policy (tools/shared/csp.ts, SITE.md §6.1).
 *
 * A policy that allows an inline script by hash breaks the moment that
 * script is edited: the browser refuses it, and the theme flashes and the
 * drawer stops working with nothing in the build to say why. So these check
 * that every page's policy is the shared one, with the hash of the inline
 * script actually on that page.
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT_ORIGIN, contentSecurityPolicy } from '../../../tools/shared/csp.js';
import { CONTACT_ENDPOINT } from '../../../tools/site/build/contact.js';
import { generate } from '../../../tools/site/build/generate.js';

const repo = resolve(import.meta.dirname, '../../..');

function hashOf(script: string): string {
  return `sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}`;
}

/** Each inline script's text, and the policy the page declares. */
function inspect(html: string): { inline: string[]; policy: string | undefined } {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1] ?? '',
  );
  const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
  return { inline, policy };
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

describe('content security policy', () => {
  it('allows the contact endpoint the form actually posts to', () => {
    expect(new URL(CONTACT_ENDPOINT).origin).toBe(CONTACT_ORIGIN);
  });

  it('is on the playground, allowing exactly its inline script', () => {
    const { inline, policy } = inspect(
      readFileSync(join(repo, 'tools/playground/index.html'), 'utf8'),
    );
    expect(inline).toHaveLength(1);
    expect(policy).toBe(contentSecurityPolicy(inline.map(hashOf)));
  });

  describe('on every generated page', () => {
    let out = '';
    beforeAll(() => {
      out = mkdtempSync(join(tmpdir(), 'ahadu-csp-'));
      generate({ contentDir: join(repo, 'tools/site/content'), outDir: out, repoDir: repo });
    }, 60_000);
    afterAll(() => {
      rmSync(out, { recursive: true, force: true });
    });

    it('allows exactly the inline scripts that page has', () => {
      const pages = htmlFiles(out);
      expect(pages.length).toBeGreaterThan(10);
      for (const file of pages) {
        const { inline, policy } = inspect(readFileSync(file, 'utf8'));
        expect(policy, file).toBe(contentSecurityPolicy(inline.map(hashOf)));
      }
    });

    it('loads nothing from another site', () => {
      for (const file of htmlFiles(out)) {
        const html = readFileSync(file, 'utf8');
        expect(html, file).not.toMatch(
          /<(script|link)[^>]+(src|href)="https?:\/\/(?!ahaducode\.com)/,
        );
      }
    });
  });
});
