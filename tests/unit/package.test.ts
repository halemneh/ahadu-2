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
