import { defineConfig, devices } from '@playwright/test';

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  testDir: './test/e2e',
  timeout: 30_000,
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'VITE_API_URL=http://127.0.0.1:8080 VITE_APP_NAME="Elemika Correction" VITE_MOCK_GQL_RUNTIME=true npm --workspace @elemika/web exec -- vite --host 127.0.0.1 --port 4174',
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
