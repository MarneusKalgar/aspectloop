import react from '@vitejs/plugin-react';
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

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      port: resolveWebPort(loadedEnv.WEB_PORT),
    },
  };
});
