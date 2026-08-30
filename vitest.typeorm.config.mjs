import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/gateway-api/test/database/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
