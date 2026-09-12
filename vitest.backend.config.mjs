import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Absolute gateway source root for its unambiguous backend-test alias. */
const gatewaySourceRoot = fileURLToPath(new URL('./apps/gateway-api/src', import.meta.url));
/** Absolute Platform source root for its unambiguous backend-test alias. */
const platformSourceRoot = fileURLToPath(new URL('./apps/platform-service/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gateway': gatewaySourceRoot,
      '@platform': platformSourceRoot,
    },
  },
  test: {
    exclude: ['apps/gateway-api/test/database/**/*.test.ts'],
    include: [
      'apps/correction-service/test/**/*.test.ts',
      'apps/extraction-service/test/**/*.test.ts',
      'apps/gateway-api/test/**/*.test.ts',
      'apps/platform-service/test/**/*.test.ts',
      'packages/backend-platform/test/**/*.test.ts',
    ],
  },
});
