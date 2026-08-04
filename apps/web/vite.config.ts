import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

function resolveWebPort(rawWebPort: string | undefined) {
  if (!rawWebPort) {
    return undefined;
  }

  const port = Number(rawWebPort);

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('WEB_PORT must be an integer between 0 and 65535.');
  }

  return port;
}

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const productionAliases =
    command === 'build'
      ? [
          {
            find: '@app/components/auth/DevelopmentTestCredentialsHint',
            replacement: fileURLToPath(
              new URL(
                './src/components/auth/DevelopmentTestCredentialsHint/production.tsx',
                import.meta.url,
              ),
            ),
          },
          {
            find: '@app/mocks/browser',
            replacement: fileURLToPath(
              new URL('./src/mocks/production-runtime.ts', import.meta.url),
            ),
          },
        ]
      : undefined;

  return {
    plugins: [react()],
    publicDir: command === 'build' ? false : 'public',
    resolve: {
      alias: productionAliases,
      tsconfigPaths: true,
    },
    server: {
      port: resolveWebPort(loadedEnv.WEB_PORT),
    },
  };
});
