import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/gateway-api/test/**/*.test.ts', 'packages/backend-platform/test/**/*.test.ts'],
  },
});
