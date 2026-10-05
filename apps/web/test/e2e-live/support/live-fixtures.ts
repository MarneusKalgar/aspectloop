import { test as base, type TestInfo } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LIVE_TOPOLOGY } from './live-topology';
import { runTool } from './local-tool.mjs';
import { ResponseGate } from './response-gate';
import { readRunScope } from './run-scope';

export interface LiveRuntime {
  accounts: [PrivateAccount, PrivateAccount];
  gate: ResponseGate;
  restorePlatform: () => Promise<void>;
  stopPlatform: () => Promise<void>;
}

export interface PrivateAccount {
  email: string;
  id: string;
  password: string;
}

/** Creates one run-owned account through a private pipe; returns only validated metadata. */
async function createAccount(id: string): Promise<PrivateAccount> {
  const password = randomBytes(32).toString('base64url');
  const output = await runTool('create', { id, input: JSON.stringify({ id, password }) });
  const line = output.split('\n').find(
    /** Parses the bounded tool envelope, not Docker/npm diagnostics. */
    (candidate) => candidate.startsWith('E1_FIXTURE '),
  );

  if (!line || line.length > 256) {
    throw new Error('E1 fixture metadata missing');
  }

  const metadata = JSON.parse(line.slice('E1_FIXTURE '.length)) as {
    email?: unknown;
    id?: unknown;
  };

  if (
    metadata.id !== id ||
    metadata.email !== `auth-http-${id}@example.test` ||
    Object.keys(metadata).length !== 2
  ) {
    throw new Error('E1 fixture metadata rejected');
  }

  return { email: metadata.email, id, password };
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

/** Bounds actual readiness, keeping outage and recovery distinct from browser transport faults. */
async function waitForGateway(ready: boolean): Promise<void> {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(LIVE_TOPOLOGY.gateway.readinessUrl, {
        signal: AbortSignal.timeout(3_000),
      });
      const body = (await response.json()) as {
        code?: unknown;
        service?: unknown;
        status?: unknown;
      };

      if (
        ready &&
        response.status === 200 &&
        body.service === 'gateway-api' &&
        body.status === 'ready'
      ) {
        return;
      }

      if (!ready && response.status === 503 && body.code === 'PLATFORM_UNAVAILABLE') {
        const liveness = await fetch(LIVE_TOPOLOGY.gateway.livenessUrl, {
          signal: AbortSignal.timeout(3_000),
        });
        const alive = (await liveness.json()) as { service?: unknown; status?: unknown };

        if (liveness.status === 200 && alive.service === 'gateway-api' && alive.status === 'ok') {
          return;
        }
      }
    } catch {
      // A missing Gateway is never proof of a Platform-only outage.
    }

    await new Promise<void>(
      /** A bounded readiness poll, not synchronization for a browser race. */
      (resolve) => setTimeout(resolve, 250),
    );
  }

  throw new Error('E1 Gateway readiness prerequisite failed');
}

export const test = base.extend<{ sanitize: void }, { live: LiveRuntime }>({
  live: [
    /** Owns fixed test transport and fixtures; parent cleanup covers worker termination too. */
    async ({ browserName }, use) => {
      if (browserName !== 'chromium') {
        throw new Error('E1 live requires the owned Chromium project');
      }

      const scope = readRunScope();
      const gate = new ResponseGate();
      let platformStopped = false;

      /** Restores only the initially healthy service this run explicitly stopped. */
      async function restorePlatform(): Promise<void> {
        if (platformStopped) {
          await runTool('restore-platform', { allowOutage: true });
          await waitForGateway(true);
          await unlink(join(scope.runDir, 'platform-stop-intent'));
          platformStopped = false;
        }
      }

      /** Persists non-secret ownership before the separately authorized exact service stop. */
      async function stopPlatform(): Promise<void> {
        await writeFile(join(scope.runDir, 'platform-stop-intent'), 'owned', { mode: 0o600 });
        platformStopped = true;

        await runTool('stop-platform', { allowOutage: true });
        await waitForGateway(false);
      }

      try {
        await waitForGateway(true);
        await gate.start();

        const preflight = await fetch(LIVE_TOPOLOGY.gate.graphqlUrl, {
          headers: {
            'access-control-request-headers': 'content-type',
            'access-control-request-method': 'POST',
            origin: LIVE_TOPOLOGY.web.origin,
          },
          method: 'OPTIONS',
          signal: AbortSignal.timeout(5_000),
        });

        if (
          preflight.status !== 204 ||
          preflight.headers.get('access-control-allow-origin') !== LIVE_TOPOLOGY.web.origin ||
          preflight.headers.get('access-control-allow-credentials') !== 'true'
        ) {
          throw new Error('E1 approved-origin CORS prerequisite failed');
        }

        const accounts: [PrivateAccount, PrivateAccount] = [
          await createAccount(scope.ids[0]),
          await createAccount(scope.ids[1]),
        ];
        await use({ accounts, gate, restorePlatform, stopPlatform });
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
