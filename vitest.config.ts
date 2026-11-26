import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The contact Worker imports Cloudflare's runtime module, which exists
    // only on Cloudflare. Its tests run against a stand-in that records what
    // would have been sent.
    alias: {
      'cloudflare:email': new URL('./tests/helpers/cloudflare-email.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'tools/playground/{view,highlight,strings,evaluate,locate}.ts'],
      // Glue is excluded, not the logic behind it. src/cli/main.ts is the
      // process shell — argv, stdin, exit codes — covered end to end by
      // commands.test.ts; the playground's main.ts and worker.ts need a DOM
      // and a worker, which is exactly why everything that makes a decision
      // lives in view.ts and highlight.ts instead.
      exclude: ['src/cli/main.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
