import { SESSION_MARKER_KEY } from '@app/auth/session-coordination/session-marker';
import { expect, type Page, type Route } from '@playwright/test';

import {
  confirmedLogout,
  cookieValue,
  fillLogin,
  holdCookieLock,
  identityVisible,
  INBOX,
  marker,
  resetRequired,
  signIn,
  signOut,
  unchangedRequests,
} from './support/browser-assertions';
import { test } from './support/live-fixtures';
import { LIVE_TOPOLOGY } from './support/live-topology';
import { originalSessionState } from './support/original-session-probe';

/** Aborts only a selected browser-to-Gateway operation; no payload or Set-Cookie is fabricated. */
async function abortSignOut(route: Route): Promise<void> {
  const body = route.request().postDataJSON() as { operationName?: unknown };

  if (body?.operationName === 'SignOut') {
    await route.abort('connectionfailed');
  } else {
    await route.continue();
  }
}

/** Waits for current ordinary validation failure, preserving the explicit Retry distinction. */
async function ordinaryUnavailable(page: Page): Promise<void> {
  await expect(page.getByText(/Authentication is temporarily unavailable/)).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Retry' })).toBeVisible();
}

test('E1-LIVE-06' /** A real browser transport abort leaves durable uncertainty; reconnect/reload never replays. */, async ({
  context,
  live,
  page,
}) => {
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, live.accounts[0]);
  await identityVisible(peer, live.accounts[0]);

  const original = await cookieValue(context);
  await context.route('**/graphql', abortSignOut);
  await signOut(page);
  await resetRequired(page);
  await resetRequired(peer);
  await context.unroute('**/graphql', abortSignOut);

  const count = live.gate.observations.length;
  await Promise.all([page.reload(), peer.reload()]);
  await resetRequired(page);
  await resetRequired(peer);
  await unchangedRequests(live.gate, count);

  expect((await cookieValue(context)) === original).toBe(true);
  expect((await marker(peer)).action?.status === 'unknown').toBe(true);
});

test('E1-LIVE-06-READ' /** Ordinary browser read failure supports explicit Retry without cookie mutation. */, async ({
  context,
  live,
  page,
}) => {
  await page.goto('/signin');
  await signIn(page, live.accounts[0]);

  const original = await cookieValue(context);
  await page.route(
    '**/graphql',
    /** Aborts only Me during bootstrap, not document/assets or cookie mutations. */
    async (route) => {
      const body = route.request().postDataJSON() as { operationName?: unknown };

      if (body?.operationName === 'Me') {
        await route.abort('connectionfailed');
      } else {
        await route.continue();
      }
    },
  );
  await page.reload();
  await ordinaryUnavailable(page);
  await page.unroute('**/graphql');
  await page.getByRole('button', { exact: true, name: 'Retry' }).click();
  await identityVisible(page, live.accounts[0]);

  expect((await cookieValue(context)) === original).toBe(true);
});

test('E1-LIVE-07' /** Actual Platform stop proves local reset-required suppression, not original-session revocation. */, async ({
  context,
  live,
  page,
}) => {
  const [a] = live.accounts;
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, a);
  await identityVisible(peer, a);

  const original = await cookieValue(context);
  await live.stopPlatform();
  const validationStart = live.gate.observations.length;
  await Promise.all([page.reload(), peer.reload()]);
  await ordinaryUnavailable(page);
  await ordinaryUnavailable(peer);

  expect((await cookieValue(context)) === original).toBe(true);
  expect(
    live.gate.observations.slice(validationStart).every(
      /** Genuine validation errors may not write either active or legacy cookies. */
      (entry) => entry.operation === 'Me' && entry.received && entry.cookieWrites === 0,
    ),
  ).toBe(true);

  await live.restorePlatform();
  await page.getByRole('button', { exact: true, name: 'Retry' }).click();
  await peer.getByRole('button', { exact: true, name: 'Retry' }).click();
  await identityVisible(page, a);
  await identityVisible(peer, a);

  expect((await cookieValue(context)) === original).toBe(true);

  await live.stopPlatform();
  const signOuts = live.gate.count('SignOut');
  await signOut(page);
  await resetRequired(page);
  await resetRequired(peer);

  expect(live.gate.count('SignOut') - signOuts).toBe(1);
  expect((await cookieValue(context)) === null).toBe(true);
  expect(
    (await marker(peer)).action?.status === 'failed' &&
      (await marker(peer)).revocation === 'unconfirmed',
  ).toBe(true);

  await live.restorePlatform();

  const count = live.gate.observations.length;

  await Promise.all([page.reload(), peer.reload()]);
  await resetRequired(page);
  await resetRequired(peer);
  await unchangedRequests(live.gate, count);

  // This private Node probe has no browser-shared jar and intentionally adds exactly one Me.
  expect((await originalSessionState(original, a.id)) === 'active').toBe(true);

  expect(live.gate.observations.length - count).toBe(1);
  expect(live.gate.count('SignOut') - signOuts).toBe(1);
  expect((await cookieValue(context)) === null).toBe(true);

  await resetRequired(page);
  await resetRequired(peer);
  await unchangedRequests(live.gate, count + 1);
});

test('E1-LIVE-08-LOCK' /** Holds a native cookie lock until the unchanged ten-second acquisition bound rejects login. */, async ({
  context,
  live,
  page,
}) => {
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  const releaseLock = await holdCookieLock(peer);

  const count = live.gate.observations.length;
  await fillLogin(page, live.accounts[0]);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toBeDisabled();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toBeEnabled();

  await unchangedRequests(live.gate, count);
  await releaseLock();
});

test('E1-LIVE-08-UNSUPPORTED' /** Injected missing Locks permits existing real reads but dispatches only local logout. */, async ({
  context,
  live,
  page,
}) => {
  await page.goto('/signin');
  await signIn(page, live.accounts[0]);

  await context.addInitScript(
    /** Removes only capability before a new provider is created; native fetch/cookies remain real. */
    () => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }),
  );
  const peer = await context.newPage();
  await peer.goto('/corrections');
  await identityVisible(peer, live.accounts[0]);

  const signOuts = live.gate.count('SignOut');
  const original = await cookieValue(context);
  await signOut(peer);
  await expect(peer.getByText(/server revocation could not be confirmed/)).toBeVisible();

  const count = live.gate.observations.length;
  await peer.reload();
  await expect(peer.getByText(/server revocation could not be confirmed/)).toBeVisible();
  await unchangedRequests(live.gate, count);

  expect(live.gate.count('SignOut') === signOuts).toBe(true);
  expect((await cookieValue(context)) === original).toBe(true);
});

test('E1-LIVE-08-CHANNEL' /** Injected missing BroadcastChannel still uses genuine cross-page storage events. */, async ({
  context,
  live,
  page,
}) => {
  await context.addInitScript(
    /** Removes only the optional notification capability. */
    () =>
      Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined }),
  );
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, live.accounts[0]);
  await identityVisible(peer, live.accounts[0]);
  await signOut(page);
  await confirmedLogout(page);
  await confirmedLogout(peer);
  await signIn(peer, live.accounts[1]);
  await identityVisible(page, live.accounts[1]);
});

test('E1-LIVE-08-CORRUPT' /** Corrupt durable storage blocks peer reads/account writes without deleting a real cookie. */, async ({
  context,
  live,
  page,
}) => {
  await page.goto('/signin');
  await signIn(page, live.accounts[0]);

  const peer = await context.newPage();
  await peer.goto('/corrections');
  await identityVisible(peer, live.accounts[0]);
  const count = live.gate.observations.length;

  await page.evaluate(
    /** Injects only malformed non-secret coordination metadata. */
    (key) => localStorage.setItem(key, '{"version":999}'),
    SESSION_MARKER_KEY,
  );
  await resetRequired(peer);
  await page.reload();
  await resetRequired(page);
  await unchangedRequests(live.gate, count);
});

test('E1-LIVE-08-DELETED' /** Deletion during an active document fails closed; it does not claim reload revocation. */, async ({
  context,
  live,
  page,
}) => {
  await page.goto('/signin');
  await signIn(page, live.accounts[0]);

  const peer = await context.newPage();
  await peer.goto('/corrections');
  await identityVisible(peer, live.accounts[0]);
  const count = live.gate.observations.length;

  await page.evaluate(
    /** Deletes only this test context's coordination marker to inject loss. */
    (key) => localStorage.removeItem(key),
    SESSION_MARKER_KEY,
  );
  await resetRequired(peer);
  await unchangedRequests(live.gate, count);
});

test('E1-LIVE-08-DENIED' /** Denied marker reads at startup block real existing-cookie bootstrap. */, async ({
  context,
  live,
  page,
}) => {
  await page.goto('/signin');
  await signIn(page, live.accounts[0]);

  await context.addInitScript(
    /** Faults only marker access; no credential, network or auth implementation is replaced. */
    (key) => {
      const get = Storage.prototype.getItem;
      /** Injects a browser storage capability failure for the one coordination key. */
      Storage.prototype.getItem = function (this: Storage, name: string): null | string {
        if (name === key) {
          throw new DOMException('Controlled storage denial', 'SecurityError');
        }

        return get.call(this, name);
      };
    },
    SESSION_MARKER_KEY,
  );
  const peer = await context.newPage();
  const count = live.gate.observations.length;
  await peer.goto('/corrections');
  await resetRequired(peer);
  await unchangedRequests(live.gate, count);
});

test('E1-LIVE-08-WRITE' /** Failed persistence retains local suppression and explicit revocation recovery, not an unknown dispatched action. */, async ({
  context,
  live,
  page,
}) => {
  await page.goto('/signin');
  await signIn(page, live.accounts[0]);

  const peer = await context.newPage();
  await peer.goto('/corrections');
  await identityVisible(peer, live.accounts[0]);

  await page.evaluate(
    /** Injects failure only into this document's marker write. */
    (key) => {
      const set = Storage.prototype.setItem;
      /** Existing cookie/storage reads stay real; no fake durable intent is supplied. */
      Storage.prototype.setItem = function (this: Storage, name: string, value: string): void {
        if (name === key) {
          throw new DOMException('Controlled storage write denial', 'QuotaExceededError');
        }

        set.call(this, name, value);
      };
    },
    SESSION_MARKER_KEY,
  );

  const signOuts = live.gate.count('SignOut');
  const original = await cookieValue(context);

  await signOut(page);
  await expect(page.getByText(/server revocation could not be confirmed/)).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Retry sign out' })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toHaveCount(0);
  await expect(page.getByRole('button', { exact: true, name: 'Retry' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: INBOX })).toHaveCount(0);

  await peer.reload();
  await identityVisible(peer, live.accounts[0]);

  expect(live.gate.count('SignOut') === signOuts).toBe(true);
  expect((await cookieValue(context)) === original).toBe(true);
});

test('E1-LIVE-09' /** Waits for SPA legacy cleanup and labels cookie invariants without exposing raw diagnostics. */, async ({
  context,
  live,
  page,
}) => {
  await test.step('BOOTSTRAP' /** Seeds only the synthetic historical cookie and waits for the real anonymous form. */, async () => {
    await context.addCookies([
      {
        domain: LIVE_TOPOLOGY.web.host,
        httpOnly: false,
        name: 'aspectloop_access_token',
        path: '/',
        sameSite: 'Lax',
        secure: false,
        value: 'synthetic-history-not-a-credential',
      },
    ]);

    await page.goto('/signin');
    await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toBeEnabled();
  });

  await test.step('LEGACY_CLEANUP' /** Allows the mounted React effect to finish; only cookie presence leaves each poll. */, async () => {
    await expect
      .poll(
        /** Returns no cookie bytes or browser storage snapshot. */
        async () =>
          (await context.cookies()).some(
            /** Selects only the proven root-path historical cookie name. */
            (cookie) => cookie.name === 'aspectloop_access_token',
          ),
        { timeout: 5_000 },
      )
      .toBe(false);
  });

  const start = live.gate.observations.length;

  await test.step('REJECTED_LOGIN' /** Exercises one real credential rejection through the existing public form. */, async () => {
    await fillLogin(page, { ...live.accounts[0], password: 'synthetic-wrong-password' });
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  await test.step('REJECTED_LOGIN_COOKIES' /** Compares only credential absence and genuine Set-Cookie counts after rejection. */, async () => {
    expect((await cookieValue(context)) === null).toBe(true);
    expect(
      live.gate.observations.slice(start).every(
        /** Failed real login does not create a credential or tombstone. */
        (entry) => entry.cookieWrites === 0,
      ),
    ).toBe(true);
  });

  await test.step('SIGN_IN' /** Requires real current Me identity after the successful public login. */, async () => {
    await signIn(page, live.accounts[0]);
  });

  const original = await cookieValue(context);
  const readStart = live.gate.observations.length;

  await test.step('ORDINARY_READ' /** Waits for real reload identity while preserving the credential and cookie-neutral reads. */, async () => {
    await page.reload();
    await identityVisible(page, live.accounts[0]);

    expect((await cookieValue(context)) === original).toBe(true);
    expect(
      live.gate.observations.slice(readStart).every(
        /** Ordinary real validation/product reads never rewrite the active cookie. */
        (entry) => entry.cookieWrites === 0,
      ),
    ).toBe(true);
  });

  await test.step('SIGN_OUT' /** Reintroduces only the historical cookie before real acknowledged revocation. */, async () => {
    await context.addCookies([
      {
        domain: LIVE_TOPOLOGY.web.host,
        httpOnly: false,
        name: 'aspectloop_access_token',
        path: '/',
        sameSite: 'Lax',
        secure: false,
        value: 'synthetic-history-not-a-credential',
      },
    ]);

    await signOut(page);
    await confirmedLogout(page);
  });

  await test.step('LOGOUT_COOKIES' /** Confirms removal of both owned names without serializing any cookie. */, async () => {
    expect(
      (await context.cookies()).some(
        /** Both exact owned names disappear after an allowed logout. */
        (cookie) => ['aspectloop_access_token', 'aspectloop_session'].includes(cookie.name),
      ),
    ).toBe(false);
  });

  await test.step('SIGN_IN_HEADERS' /** Requires separate genuine active issuance and legacy tombstone headers. */, () => {
    expect(
      live.gate.observations.slice(start).some(
        /** The current successful login preserved separate active/legacy headers. */
        (entry) => entry.operation === 'SignIn' && entry.cookieWrites === 2,
      ),
    ).toBe(true);
  });

  await test.step('SIGN_OUT_HEADERS' /** Requires both genuine exact-path tombstones after acknowledged logout. */, () => {
    expect(
      live.gate.observations.slice(start).some(
        /** The current allowed logout preserved both exact-path tombstones. */
        (entry) => entry.operation === 'SignOut' && entry.cookieWrites === 2,
      ),
    ).toBe(true);
  });
});
