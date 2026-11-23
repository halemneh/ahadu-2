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

import {
  copyFileSync,
  createReadStream,
  existsSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild, defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { generate } from './build/generate.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const pages = resolve(here, '.generated');
const playground = resolve(repo, 'tools/playground');
/*
 * Its own directory, not a folder inside `.generated`: regenerating the
 * content empties that one, which would delete the playground from under the
 * dev server the first time anyone edited a lesson.
 */
const playgroundPages = resolve(here, '.playground');

/** Enough to serve the playground's own build; it emits nothing else. */
const MEDIA: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

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

    /*
     * The playground is a separate build that used to exist only in `dist/`,
     * so in development `/playground/` was a 404 — from the nav tab and from
     * every "open in playground" link in a lesson. Build it into the tree the
     * dev server already serves, so development matches production.
     *
     * It is built, not proxied or served from source: a page served from
     * outside the root skips Vite's HTML transform, which leaves its own
     * relative imports to resolve against the browser's URL and break. The
     * cost is that it is a snapshot — `npm run play` is still the way to work
     * on the playground itself, with hot reload, which is what that script is
     * for.
     */
    async configureServer(server): Promise<void> {
      await viteBuild({
        configFile: resolve(playground, 'vite.config.ts'),
        base: '/playground/',
        logLevel: 'warn',
        build: { outDir: playgroundPages, emptyOutDir: true },
      });

      /*
       * The playground is served straight off disk, deliberately bypassing
       * Vite. Letting it serve these files instead re-transforms an already
       * built bundle: Vite sees the worker's URL inside it, treats it as
       * source to resolve again, and rewrites it to a path that does not
       * exist — so the page loads and every Run fails.
       */
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0] ?? '/';
        if (path !== '/playground' && !path.startsWith('/playground/')) {
          next();
          return;
        }

        const rest = path.replace(/^\/playground\/?/, '');
        const file = join(playgroundPages, rest === '' ? 'index.html' : rest);
        if (!existsSync(file) || statSync(file).isDirectory()) {
          next();
          return;
        }

        res.setHeader('content-type', MEDIA[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });

      // In development the pages sit under /.generated/, which is not where
      // they will live. Rewrite so the URLs a reader sees are the real ones —
      // sitemap.xml and robots.txt included, so a broken one is visible here
      // rather than only after a deploy.
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        if (/^\/(am|en)(\/|$)/.test(url)) {
          const path = url.endsWith('/') ? `${url}index.html` : url;
          req.url = `/.generated${path}`;
        } else if (url === '/' || url === '/index.html') {
          req.url = '/.generated/index.html';
        } else if (url === '/sitemap.xml' || url === '/robots.txt') {
          req.url = `/.generated${url}`;
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
     *
     * sitemap.xml and robots.txt are copied separately: Rollup only knows
     * about the HTML files it was given as inputs, so anything else the
     * generator wrote is invisible to it and would never reach `dist/`.
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

      for (const name of ['sitemap.xml', 'robots.txt']) {
        const from = join(pages, name);
        if (existsSync(from)) copyFileSync(from, join(out, name));
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
