/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

import { LIVE_TOPOLOGY } from './test/e2e-live/support/live-topology';
import { readRunScope } from './test/e2e-live/support/run-scope';

const { runDir } = readRunScope();

export default defineConfig({
  captureGitInfo: { commit: false, diff: false },
  fullyParallel: false,
  globalTimeout: 10 * 60_000,
  maxFailures: 1,
  outputDir: join(runDir, 'artifacts'),
  preserveOutput: 'never',
  projects: [{ name: 'live-chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['./test/e2e-live/support/safe-reporter.ts']],
  retries: 0,
  testDir: './test/e2e-live',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  use: {
    actionTimeout: 15_000,
    baseURL: LIVE_TOPOLOGY.web.origin,
    navigationTimeout: 15_000,
    reuseContext: false,
    screenshot: 'off',
    serviceWorkers: 'block',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    command: `npm --workspace @aspectloop/web exec -- vite --host ${LIVE_TOPOLOGY.web.host} --port ${LIVE_TOPOLOGY.web.port} --strictPort`,
    env: {
      VITE_API_URL: LIVE_TOPOLOGY.gate.apiOrigin,
      VITE_APP_NAME: 'AspectLoop',
      VITE_MOCK_GQL_RUNTIME: 'false',
    },
    reuseExistingServer: false,
    stderr: 'ignore',
    stdout: 'ignore',
    timeout: 30_000,
    url: LIVE_TOPOLOGY.web.origin,
  },
  workers: 1,
});
