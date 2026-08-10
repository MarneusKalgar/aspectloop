import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/integration/**/*.test.ts', 'test/integration/**/*.test.tsx'],
    },
  }),
);
