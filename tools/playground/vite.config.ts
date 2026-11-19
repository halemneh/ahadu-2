/**
 * Playground build (TOOLING.md §2.3).
 *
 * The root is this directory, so `index.html` is the entry and the examples
 * are pulled in from the repository above it by `import.meta.glob`. The
 * output is plain static files: no server, no headers, nothing sent anywhere.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');

export default defineConfig({
  root: here,
  // Relative asset URLs, so the built page works from a file path or any
  // subdirectory without being told where it lives.
  base: './',
  server: {
    // The interpreter is imported from src/, and the examples from
    // examples/ — both outside this root.
    fs: { allow: [repo] },
  },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
});
