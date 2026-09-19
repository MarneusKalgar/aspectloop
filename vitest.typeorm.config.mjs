import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Absolute Platform source root for its unambiguous TypeORM-test alias. */
const platformSourceRoot = fileURLToPath(new URL('./apps/platform-service/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@platform': platformSourceRoot,
    },
  },
  test: {
    include: ['apps/platform-service/test/database/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
