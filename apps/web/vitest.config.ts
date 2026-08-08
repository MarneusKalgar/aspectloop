import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'import.meta.env.BROWSER_MOCK_ENABLED': JSON.stringify(false),
    'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:8080'),
    'import.meta.env.VITE_APP_NAME': JSON.stringify('Elemika Correction'),
  },
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://127.0.0.1:4174',
      },
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
