import { expect } from '@playwright/test';

import {
  confirmedLogout,
  cookieAttributes,
  cookieValue,
  fillLogin,
  holdCookieLock,
  identityVisible,
  marker,
  meCount,
  observeMe,
  resetRequired,
  secretSeparation,
  signIn,
  signOut,
  unchangedRequests,
} from './support/browser-assertions';
import { test } from './support/live-fixtures';
import { originalSessionState } from './support/original-session-probe';

test('E1-LIVE-01' /** Proves real-cookie bootstrap and independent current identity validation in two pages. */, async ({
  context,
  live,
  page,
}) => {
  const [a] = live.accounts;
  const peer = await context.newPage();
  const first = observeMe(page);
  const second = observeMe(peer);

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, a);
  await identityVisible(peer, a);
  await Promise.all([page.reload(), peer.reload()]);
  await identityVisible(page, a);
  await identityVisible(peer, a);

  await expect
    .poll(
      /** Both pages, not just shared mutation data, must receive real authoritative Me. */
      () => meCount(first, a) >= 2 && meCount(second, a) >= 2,
    )
    .toBe(true);

  await cookieAttributes(context);
  await secretSeparation(page, live.gate);
});

test('E1-LIVE-02' /** Proves exactly one logout and independent A-to-B identity retirement in both pages. */, async ({
  context,
  live,
  page,
}) => {
  const [a, b] = live.accounts;
  const peer = await context.newPage();
  const first = observeMe(page);
  const second = observeMe(peer);
  const before = live.gate.count('SignOut');

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, a);
  await identityVisible(peer, a);

  const original = await cookieValue(context);

  await signOut(page);
  await confirmedLogout(page);
  await confirmedLogout(peer);

  expect(live.gate.count('SignOut') - before).toBe(1);
  expect((await cookieValue(context)) === null).toBe(true);

  expect((await originalSessionState(original, a.id)) === 'invalid').toBe(true);

  await signIn(peer, b);
  await identityVisible(page, b);
  await expect
    .poll(
      /** Each tab receives B through its own uncached request. */
      () => first.ids.includes(b.id) && second.ids.includes(b.id),
    )
    .toBe(true);

  expect(
    await page.evaluate(
      /** Compares retired identity in memory and returns only a boolean. */
      (email) => !document.body.innerText.includes(email),
      a.email,
    ),
  ).toBe(true);
});

test('E1-LIVE-02-CONCURRENT' /** Uses two actual forms and a real response barrier to bound competing logins. */, async ({
  context,
  live,
  page,
}) => {
  const peer = await context.newPage();
  const before = live.gate.count('SignIn');
  const hold = live.gate.holdNext('SignIn');

  await page.goto('/signin');
  await peer.goto('/signin');
  await fillLogin(page, live.accounts[0]);
  await fillLogin(peer, live.accounts[1]);
  const releaseLock = await holdCookieLock(peer);

  await Promise.all([
    page.getByRole('button', { exact: true, name: 'Sign in' }).evaluate(
      /** Submits the real public form without waiting for a peer-driven rerender. */
      (button: HTMLButtonElement) => button.click(),
    ),
    peer.getByRole('button', { exact: true, name: 'Sign in' }).evaluate(
      /** Starts the second real UI attempt, never invoking coordinator internals. */
      (button: HTMLButtonElement) => button.click(),
    ),
  ]);

  await expect(page.getByRole('button', { exact: true, name: 'Sign in' })).toBeDisabled();
  await expect(peer.getByRole('button', { exact: true, name: 'Sign in' })).toBeDisabled();
  await releaseLock();
  await hold.received();
  const pending = live.gate.observations.length;
  await unchangedRequests(live.gate, pending);
  hold.release();
  await hold.closed();

  await expect
    .poll(
      /** Exactly one queued attempt may dispatch; the other must recheck its retired generation. */
      () => live.gate.count('SignIn') - before,
    )
    .toBe(1);

  const first = observeMe(page);
  const second = observeMe(peer);
  await Promise.all([page.reload(), peer.reload()]);

  await expect
    .poll(
      /** The shared cookie is independently validated as the same run-owned account. */
      () =>
        first.ids.length > 0 &&
        second.ids.length > 0 &&
        first.ids.at(-1) === second.ids.at(-1) &&
        live.accounts.some(
          /** Only one of this run's two actual accounts can satisfy the shared-cookie result. */
          (account) => account.id === first.ids.at(-1),
        ),
    )
    .toBe(true);
  expect(live.gate.maxCookieActions).toBe(1);
});

test('E1-LIVE-03' /** Holds genuine Set-Cookie until durable peer logout is published and releases only in order. */, async ({
  context,
  live,
  page,
}) => {
  const peer = await context.newPage();
  const hold = live.gate.holdNext('SignIn');
  const before = live.gate.count('SignOut');

  await page.goto('/signin');
  await peer.goto('/signin');
  const original = await cookieValue(context);
  await fillLogin(page, live.accounts[0]);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await hold.received();

  expect((await cookieValue(context)) === original).toBe(true);
  await peer.getByRole('button', { exact: true, name: 'Sign out locally' }).click();
  await expect
    .poll(
      /** Waits for successful persistence before permitting the earlier cookie delivery. */
      async () => (await marker(peer)).logoutIntent,
    )
    .toBe(true);

  await unchangedRequests(live.gate, live.gate.observations.length);
  expect(live.gate.count('SignOut') === before).toBe(true);
  hold.release();
  await confirmedLogout(page);
  await confirmedLogout(peer);

  expect(live.gate.count('SignOut') - before).toBe(1);
  expect(live.gate.maxCookieActions).toBe(1);
  expect((await cookieValue(context)) === null).toBe(true);
});

test('E1-LIVE-04' /** Blocks newer login while a genuine logout response is unsettled. */, async ({
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
  const hold = live.gate.holdNext('SignOut');
  const signIns = live.gate.count('SignIn');
  await signOut(page);
  await hold.received();
  await peer.goto('/signin');

  expect((await cookieValue(context)) === original).toBe(true);
  await expect(peer.getByRole('button', { exact: true, name: 'Sign in' })).toHaveCount(0);
  await unchangedRequests(live.gate, live.gate.observations.length);
  expect(live.gate.count('SignIn') === signIns).toBe(true);

  hold.release();
  await confirmedLogout(peer);
  await signIn(peer, live.accounts[1]);
  await identityVisible(page, live.accounts[1]);
});

test('E1-LIVE-04-TIMEOUT' /** Uses the unchanged production deadline; an old response grants no permission after reload. */, async ({
  context,
  live,
  page,
}) => {
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, live.accounts[0]);
  await identityVisible(peer, live.accounts[0]);

  const hold = live.gate.holdNext('SignOut');
  await signOut(page);
  await hold.received();
  await expect
    .poll(
      /** Waits for the actual ten-second timeout transition, not an arbitrary test sleep. */
      async () => (await marker(peer)).action?.status,
      { timeout: 15_000 },
    )
    .toBe('unknown');
  await hold.closed();

  const count = live.gate.observations.length;
  await Promise.all([page.reload(), peer.reload()]);
  await resetRequired(page);
  await resetRequired(peer);
  hold.release();

  await unchangedRequests(live.gate, count);
});

test('E1-LIVE-04-OWNER' /** Closes the owner with a real cookie response held; released native locks do not prove rollback. */, async ({
  context,
  live,
  page,
}) => {
  const peer = await context.newPage();
  const hold = live.gate.holdNext('SignIn');

  await page.goto('/signin');
  await peer.goto('/signin');
  await fillLogin(page, live.accounts[0]);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await hold.received();
  await page.close();
  await hold.closed();
  await resetRequired(peer);

  const count = live.gate.observations.length;
  hold.release();
  await peer.reload();
  await resetRequired(peer);
  await unchangedRequests(live.gate, count);
});

test('E1-LIVE-05' /** Retires actual A Me/product transport before independently validating B; inbox data stays empty. */, async ({
  context,
  live,
  page,
}) => {
  const [a, b] = live.accounts;
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, a);
  await identityVisible(peer, a);

  const product = live.gate.holdNext('CorrectionSessions');
  await page.reload();
  await product.received();
  expect(
    live.gate.observations.at(-1)?.operation === 'CorrectionSessions' &&
      live.gate.observations.at(-1)?.success === true,
  ).toBe(true);
  const identity = live.gate.holdNext('Me');
  await peer.reload();
  await identity.received();

  await signOut(page);
  await confirmedLogout(page);
  await product.closed();
  await identity.closed();
  const productCount = live.gate.count('CorrectionSessions');
  await signIn(page, b);
  await identityVisible(peer, b);
  await expect
    .poll(
      /** Current B product requests complete separately from cancelled A transports. */
      () =>
        live.gate.count('CorrectionSessions') > productCount &&
        live.gate.observations.filter(
          /** Selects only current successful product completion metadata. */
          (entry) => entry.operation === 'CorrectionSessions' && entry.received && entry.success,
        ).length >= 3,
    )
    .toBe(true);

  product.release();
  identity.release();
  await identityVisible(page, b);
  await identityVisible(peer, b);

  const current = await marker(peer);
  expect(!current.logoutIntent && !current.action).toBe(true);
});

test('E1-LIVE-05-ERROR' /** A real delayed upstream error from A cannot retire a later B generation. */, async ({
  context,
  live,
  page,
}) => {
  const [a, b] = live.accounts;
  const peer = await context.newPage();

  await page.goto('/signin');
  await peer.goto('/signin');
  await signIn(page, a);
  await identityVisible(peer, a);

  await live.stopPlatform();
  const oldError = live.gate.holdNext('Me');
  await peer.reload();
  await oldError.received();
  await live.restorePlatform();
  await signOut(page);
  await confirmedLogout(page);
  await oldError.closed();
  await signIn(page, b);
  await identityVisible(peer, b);
  oldError.release();
  await identityVisible(page, b);
  await identityVisible(peer, b);
});
