import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // main.ts is the process shell — argv, stdin, exit codes — and is
      // covered end to end by tests/unit/cli/commands.test.ts instead. The
      // rest of the CLI is ordinary code with ordinary tests.
      exclude: ['src/cli/main.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
