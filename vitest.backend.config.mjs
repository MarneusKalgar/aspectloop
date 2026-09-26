import { resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Absolute gateway source root for its unambiguous backend-test alias. */
const gatewaySourceRoot = fileURLToPath(new URL('./apps/gateway-api/src', import.meta.url));
/** Absolute Platform source root for its unambiguous backend-test alias. */
const platformSourceRoot = fileURLToPath(new URL('./apps/platform-service/src', import.meta.url));
/** Source roots for the backend applications sharing this test runner. */
const applicationSourceRoots = [
  fileURLToPath(new URL('./apps/correction-service/src', import.meta.url)),
  fileURLToPath(new URL('./apps/extraction-service/src', import.meta.url)),
  gatewaySourceRoot,
  platformSourceRoot,
];

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      name: 'resolve-application-private-imports',
      /**
       * Resolves a private import from the application that owns its importer.
       *
       * @param {string} source Import specifier.
       * @param {string | undefined} importer Absolute path of the importing module.
       * @returns {Promise<unknown>} The resolved source module or null when not applicable.
       */
      async resolveId(source, importer) {
        if (!source.startsWith('#app/') || !importer) {
          return null;
        }

        const sourceRoot = applicationSourceRoots.find((root) =>
          importer.startsWith(`${root}${sep}`),
        );

        if (!sourceRoot) {
          return null;
        }

        return this.resolve(resolve(sourceRoot, source.slice('#app/'.length)), importer, {
          skipSelf: true,
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@gateway': gatewaySourceRoot,
      '@platform': platformSourceRoot,
    },
  },
  test: {
    exclude: ['apps/platform-service/test/database/**/*.test.ts'],
    include: [
      'apps/correction-service/test/**/*.test.ts',
      'apps/extraction-service/test/**/*.test.ts',
      'apps/gateway-api/test/**/*.test.ts',
      'apps/platform-service/test/**/*.test.ts',
      'packages/backend-platform/test/**/*.test.ts',
    ],
  },
});
