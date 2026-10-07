import {
  parseSessionMarker,
  SESSION_COOKIE_LOCK,
  SESSION_MARKER_KEY,
  type SessionMarker,
} from '@app/auth/session-coordination/session-marker';
import { type BrowserContext, expect, type Page } from '@playwright/test';

import type { PrivateAccount } from './live-fixtures';
import type { ResponseGate } from './response-gate';

import { LIVE_TOPOLOGY } from './live-topology';

export const INBOX = 'Correction inbox';
export const FIXTURE_NAME = /Auth HTTP verification fixture/;

/** Waits for durable intent/acknowledgement instead of inferring cookie order from elapsed time. */
export async function confirmedLogout(page: Page): Promise<void> {
  await expect
    .poll(
      /** Only a boolean leaves the marker comparison. */
      async () => {
        const current = await marker(page);
        return (
          current.logoutIntent && current.revocation === 'confirmed' && current.action === null
        );
      },
    )
    .toBe(true);

  await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toBeVisible();
}

/** Checks production cookie attributes without serializing the cookie itself. */
export async function cookieAttributes(context: BrowserContext): Promise<void> {
  const cookie = (await context.cookies()).find(
    /** Selects the active credential by name. */
    (candidate) => candidate.name === 'aspectloop_session',
  );

  expect(
    !!cookie &&
      cookie.domain === LIVE_TOPOLOGY.web.host &&
      cookie.path === '/graphql' &&
      cookie.httpOnly &&
      cookie.sameSite === 'Lax' &&
      !cookie.secure &&
      cookie.expires > Date.now() / 1000,
  ).toBe(true);
}

/** Retains opaque cookie bytes in memory only; assertions must compare booleans, never values. */
export async function cookieValue(context: BrowserContext): Promise<null | string> {
  const cookie = (await context.cookies(`${LIVE_TOPOLOGY.gate.apiOrigin}/graphql`)).find(
    /** Selects only the active browser credential, without exposing it. */
    (candidate) => candidate.name === 'aspectloop_session',
  );

  return cookie?.value ?? null;
}

/** Logs in only through the public form; ephemeral credentials never enter assertions. */
export async function fillLogin(page: Page, account: PrivateAccount): Promise<void> {
  try {
    await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
  } catch {
    // Playwright fill call logs can include input bytes; never retain that cause.
    throw new Error('E1 private form input failed; details omitted.');
  }
}

/** Acquires a real test-owned cookie lock and returns an explicit release barrier. */
export async function holdCookieLock(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(
    /** Resolves only after native acquisition; the test controls no application state. */
    async (name) => {
      const owner = window as typeof window & { e1ReleaseLock?: () => void };

      await new Promise<void>(
        /** Separates acquisition completion from the lifetime of actual lock ownership. */
        (resolve, reject) => {
          void navigator.locks
            .request(
              name,
              /** Holds the native lock until the explicit release or owned context disposal. */
              async () => {
                resolve();

                await new Promise<void>(
                  /** Keeps only a test-owned release callback in this document. */
                  (release) => {
                    owner.e1ReleaseLock = release;
                  },
                );
              },
            )
            .catch(reject);
        },
      );
    },
    SESSION_COOKIE_LOCK,
  );

  /** Releases only the injected native lock; normal context disposal is the fallback. */
  return async () => {
    await page.evaluate(
      /** Invokes only the test-owned release callback, never coordinator internals. */
      () => (window as typeof window & { e1ReleaseLock?: () => void }).e1ReleaseLock?.(),
    );
  };
}

/** Asserts identity as a boolean so failure reports cannot serialize fixture emails or DOM text. */
export async function identityVisible(page: Page, account: PrivateAccount): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: INBOX })).toBeVisible();

  await expect
    .poll(
      /** Compares identity in browser memory and returns no user projection. */
      () =>
        page.evaluate(
          /** Reads visible text only long enough to perform this private comparison. */
          (email) => document.body.innerText.includes(email),
          account.email,
        ),
    )
    .toBe(true);
}

/** Reads only the approved bounded marker, reusing its strict schema without persistence. */
export async function marker(page: Page): Promise<SessionMarker> {
  const raw = await page.evaluate(
    /** Never reads the complete local/session storage or any credential. */
    (key) => localStorage.getItem(key),
    SESSION_MARKER_KEY,
  );

  return parseSessionMarker(raw);
}

/** Counts only authoritative current-account UUID observations, never mutation-payload identity. */
export function meCount(state: { ids: string[] }, account: PrivateAccount): number {
  return state.ids.filter(
    /** Compares run-owned metadata without reporting it in an assertion. */
    (id) => id === account.id,
  ).length;
}

/** Proves each page independently received current real Me data, without recording raw payloads. */
export function observeMe(page: Page): { ids: string[] } {
  const state = { ids: [] as string[] };

  page.on(
    'response',
    /** Retains only UUID metadata from a real response; no route.fetch or shared request jar. */
    async (response) => {
      if (!response.url().endsWith('/graphql')) {
        return;
      }

      try {
        const request = response.request().postDataJSON() as { operationName?: unknown };

        if (request.operationName !== 'Me') {
          return;
        }

        const result = (await response.json()) as { data?: { me?: { id?: unknown } } };

        if (typeof result.data?.me?.id === 'string') {
          state.ids.push(result.data.me.id);
        }
      } catch {
        // A cancelled old response has no observed identity; it is not a failure or retry.
      }
    },
  );

  return state;
}

/** Proves failed, unknown, orphaned or ambiguous actions offer neither replay nor new login. */
export async function resetRequired(page: Page): Promise<void> {
  await expect(page.getByText(/An account action is unresolved/)).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toHaveCount(0);
  await expect(page.getByRole('button', { exact: true, name: 'Retry' })).toHaveCount(0);
  await expect(page.getByRole('button', { exact: true, name: 'Retry sign out' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: INBOX })).toHaveCount(0);
}

/** Checks marker/storage and real transport metadata without emitting values on failure. */
export async function secretSeparation(page: Page, gate: ResponseGate): Promise<void> {
  const current = await marker(page);
  expect(
    Object.keys(current).sort().join(',') === 'action,epoch,logoutIntent,revocation,version',
  ).toBe(true);

  expect(
    await page.evaluate(
      /** Returns one boolean for forbidden stored credentials; no storage snapshot is captured. */
      () =>
        [localStorage, sessionStorage].every(
          /** Rejects known credential vocabulary and bearer material without retaining it. */
          (storage) =>
            Object.keys(storage).every(
              /** Inspects values only in browser memory. */
              (key) =>
                !/access.?token|refresh.?token|password|authorization/i.test(
                  `${key}:${storage.getItem(key)}`,
                ),
            ),
        ),
    ),
  ).toBe(true);
  expect(
    gate.observations.every(
      /** Every allowed request stays cookie-based and every completed response stays no-store. */
      (entry) => !entry.bearer && (!entry.received || entry.noStore),
    ),
  ).toBe(true);
}

/** Requests one explicit UI login; authoritative Me, not the mutation payload, publishes identity. */
export async function signIn(page: Page, account: PrivateAccount): Promise<void> {
  await fillLogin(page, account);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await identityVisible(page, account);
}

/** Opens the existing account menu and requests one explicit logout. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: FIXTURE_NAME }).click();
  await page.getByRole('menuitem', { exact: true, name: 'Sign out' }).click();
}

/** Observes absence over a bounded interval; a single instantaneous counter is insufficient. */
export async function unchangedRequests(gate: ResponseGate, count: number): Promise<void> {
  const deadline = Date.now() + 600;

  do {
    expect(gate.observations.length === count).toBe(true);

    await new Promise<void>(
      /** This is an explicit negative-observation interval, not a race synchronization sleep. */
      (resolve) => setTimeout(resolve, 50),
    );
  } while (Date.now() < deadline);
}
