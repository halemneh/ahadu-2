/**
 * Site build (SITE.md).
 *
 * Two stages. `generate()` turns `content/` into static HTML — running every
 * code sample through the real interpreter as it goes — and Vite then bundles
 * the one client script those pages reference. Vite is not asked to understand
 * the content; it handles the parts that genuinely need bundling.
 *
 * The generated pages live in `.generated/` rather than beside their sources,
 * so the content directory stays something a person can read.
 */

import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { generate } from './build/generate.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const pages = resolve(here, '.generated');

/** Every generated page, as Rollup inputs. */
function htmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

function build(): void {
  const result = generate({
    contentDir: resolve(here, 'content'),
    outDir: pages,
    repoDir: repo,
  });
  // Worth printing: the snippet count is how many programs were just run and
  // checked, which is the site's main claim about itself.
  console.log(`site: ${result.pages} pages, ${result.snippets} snippets verified`);
}

/*
 * Generated before the config is handed over, not in `buildStart`: Rollup is
 * given the page list as `input`, and that list is read from disk — on a clean
 * checkout there would be nothing there to find.
 */
build();

function sitePlugin(): Plugin {
  return {
    name: 'ahadu-site',

    configureServer(server): void {
      // In development the pages sit under /.generated/, which is not where
      // they will live. Rewrite so the URLs a reader sees are the real ones.
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        if (/^\/(am|en)(\/|$)/.test(url)) {
          const path = url.endsWith('/') ? `${url}index.html` : url;
          req.url = `/.generated${path}`;
        } else if (url === '/' || url === '/index.html') {
          req.url = '/.generated/index.html';
        }
        next();
      });

      // Rebuild when content or the generator changes.
      server.watcher.add([resolve(here, 'content'), resolve(here, 'build')]);
      server.watcher.on('change', (file) => {
        if (file.includes('/content/') || file.includes('/site/build/')) {
          try {
            build();
            server.ws.send({ type: 'full-reload' });
          } catch (error) {
            server.config.logger.error(String(error));
          }
        }
      });
    },

    /**
     * Rollup names an output after its input's path from the root, so pages
     * built out of `.generated/` land under `dist/.generated/`. Lift them to
     * the top and copy the stylesheet, which needs no bundling.
     */
    closeBundle(): void {
      const out = resolve(here, 'dist');
      const nested = join(out, '.generated');
      if (existsSync(nested)) {
        for (const name of readdirSync(nested)) {
          rmSync(join(out, name), { recursive: true, force: true });
          renameSync(join(nested, name), join(out, name));
        }
        rmSync(nested, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  root: here,
  base: '/',
  plugins: [sitePlugin()],
  server: {
    port: 5174,
    // The interpreter is imported from src/, and the examples from examples/.
    fs: { allow: [repo] },
  },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: htmlFiles(pages) },
  },
});
