import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['apps/gateway-api/test/database/**/*.test.ts'],
    include: ['apps/gateway-api/test/**/*.test.ts', 'packages/backend-platform/test/**/*.test.ts'],
  },
});
