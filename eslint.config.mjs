// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import perfectionist from 'eslint-plugin-perfectionist';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'node_modules/**',
      '.husky/**',
      'eslint.config.mjs',
      '**/public/**',
      '**/design/**',
      '**/.storybook/**',
      '**/*.stories.{ts,tsx}',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettierRecommended,
  perfectionist.configs['recommended-natural'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      sourceType: 'module',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['apps/web/.storybook/**/*.{ts,tsx}', 'apps/web/src/**/*.stories.tsx'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        project: false,
        projectService: false,
      },
    },
  },
  {
    files: [
      'apps/web/codegen.ts',
      'apps/web/vite.config.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: './apps/web/tsconfig.node.json',
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      'apps/web/src/**/*.test.ts',
      'apps/web/src/**/*.test.tsx',
      'apps/web/src/test/**/*.{ts,tsx}',
      'apps/web/test/integration/**/*.{ts,tsx}',
      'apps/web/test/e2e/**/*.{ts,tsx}',
      'apps/web/vitest.config.ts',
      'apps/web/vitest.unit.config.ts',
      'apps/web/vitest.integration.config.ts',
      'apps/web/playwright.config.ts',
    ],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        project: false,
        projectService: false,
      },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
];
