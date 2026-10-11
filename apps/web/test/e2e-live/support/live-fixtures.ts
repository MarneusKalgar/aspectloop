import { test as base, type TestInfo } from '@playwright/test';

import type { PrivateAccount, PrivateRegistration } from './private-fixtures.ts';

import { verifyGatePreflight, waitForGateway } from './live-prerequisites.ts';
import { createOwnedPlatformOutage } from './owned-platform-outage.ts';
import { createAccount, createRegistrationFixture } from './private-fixtures.ts';
import { ResponseGate } from './response-gate';
import { readRunScope } from './run-scope';

export type { PrivateAccount } from './private-fixtures.ts';

export interface LiveRuntime {
  accounts: [PrivateAccount, PrivateAccount];
  gate: ResponseGate;
  registration: null | PrivateRegistration;
  restorePlatform: () => Promise<void>;
  stopPlatform: () => Promise<void>;
}

/** Removes raw diagnostic fields before Playwright writes automatic error-context artifacts. */
function sanitizeFailures(info: TestInfo): void {
  for (const error of info.errors) {
    // Omit messages entirely so the installed artifact recorder writes no error-context file.
    error.message = undefined;
    error.stack = undefined;
    error.value = undefined;
    error.cause = undefined;
    error.errorContext = undefined;
  }

  info.attachments.length = 0;
}

export const test = base.extend<{ sanitize: void }, { live: LiveRuntime }>({
  live: [
    /** Owns fixed test transport and fixtures; parent cleanup covers worker termination too. */
    async ({ browserName }, use) => {
      if (browserName !== 'chromium') {
        throw new Error('E1 live requires the owned Chromium project');
      }

      const scope = readRunScope();
      const gate = new ResponseGate(Boolean(scope.registrationId));
      const { restorePlatform, stopPlatform } = createOwnedPlatformOutage(scope.runDir);

      try {
        await waitForGateway(true);
        await gate.start();
        await verifyGatePreflight();

        const accounts: [PrivateAccount, PrivateAccount] = [
          await createAccount(scope.ids[0]),
          await createAccount(scope.ids[1]),
        ];
        const registration = await createRegistrationFixture(scope);

        await use({ accounts, gate, registration, restorePlatform, stopPlatform });
      } catch {
        throw new Error('E1 live fixture/precondition failed; details omitted.');
      } finally {
        try {
          await restorePlatform();
        } finally {
          await gate.stop();
        }
      }
    },
    { scope: 'worker', timeout: 150_000 },
  ],
  sanitize: [
    /** Installs a failure boundary outside test/fixture teardown to prevent raw persisted diagnostics. */
    async ({ live }, use, info) => {
      try {
        await use();
      } finally {
        live.gate.releaseAll();
        sanitizeFailures(info);
      }
    },
    { auto: true },
  ],
});

test.afterEach(
  /** Releases response buffers and restores faults before the next fresh context. */
  async ({ live }, info) => {
    try {
      live.gate.releaseAll();
      await live.restorePlatform();

      if (live.gate.unexpectedRequests !== 0) {
        throw new Error('E1 unexpected operation observed');
      }
    } finally {
      sanitizeFailures(info);
    }
  },
);
