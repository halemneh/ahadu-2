import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'tools/playground/{view,highlight}.ts'],
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
