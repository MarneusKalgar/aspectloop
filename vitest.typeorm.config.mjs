import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Absolute gateway source root for its unambiguous TypeORM-test alias. */
const gatewaySourceRoot = fileURLToPath(new URL('./apps/gateway-api/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gateway': gatewaySourceRoot,
    },
  },
  test: {
    include: ['apps/gateway-api/test/database/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
