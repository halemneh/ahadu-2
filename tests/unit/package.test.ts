import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('package metadata', () => {
  it('VERSION matches package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
  });

  it('the spec ships with the package', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      files: string[];
    };
    expect(pkg.files).toContain('spec/');
  });
});

describe('licensing', () => {
  // Two licences, and the boundary between them is a decision rather than an
  // accident: prose under tools/site/content/ is share-alike, everything else
  // is MIT. A missing file or an unexplained boundary is how dual licensing
  // quietly stops meaning anything.
  const read = (name: string): string => readFileSync(resolve(root, name), 'utf8');

  it('ships both licence files', () => {
    expect(read('LICENSE')).toContain('MIT License');
    expect(read('LICENSE-CONTENT')).toContain('Attribution-ShareAlike 4.0 International');
  });

  it('says which licence covers the content, and where the boundary is', () => {
    const content = read('LICENSE-CONTENT');
    expect(content).toContain('tools/site/content/');
    expect(content).toContain('MIT');
  });

  it('explains both in the README, with the boundary named', () => {
    const readme = read('README.md');
    expect(readme).toContain('LICENSE-CONTENT');
    expect(readme).toContain('tools/site/content/');
    expect(readme).toContain('CC BY-SA 4.0');
  });

  it('keeps the npm package MIT, since it ships no prose', () => {
    // package.json's `files` is dist/ and spec/ — both MIT. If prose is ever
    // added to the published package, this licence field becomes wrong.
    const pkg = JSON.parse(read('package.json')) as { license: string; files: string[] };
    expect(pkg.license).toBe('MIT');
    expect(pkg.files.some((f) => f.includes('content'))).toBe(false);
  });
});
