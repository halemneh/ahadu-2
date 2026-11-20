import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Build output, including the site's generated pages and the snapshot of
    // the playground its dev server serves.
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/node_modules/',
      '**/.generated/',
      '**/.playground/',
      '**/shots/',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Config files are plain ESM with no type information worth checking.
    files: ['*.js', '*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Development scripts: plain ESM, outside the TypeScript project, and not
    // shipped. Typing Playwright's page objects here would buy nothing.
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: { project: false, projectService: false },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // Annotating a script that is never imported adds noise, not safety.
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  prettier,
);
