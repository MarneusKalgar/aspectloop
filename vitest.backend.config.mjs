import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['apps/gateway-api/test/database/**/*.test.ts'],
    include: [
      'apps/correction-service/test/**/*.test.ts',
      'apps/extraction-service/test/**/*.test.ts',
      'apps/gateway-api/test/**/*.test.ts',
      'packages/backend-platform/test/**/*.test.ts',
    ],
  },
});
