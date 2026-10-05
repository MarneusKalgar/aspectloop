import type { MeQuery, SignOutMutation } from '@app/graphql/generated/graphql';

import { ApolloClient } from '@apollo/client/core';
import {
  INITIAL_SESSION_MARKER,
  SESSION_MARKER_KEY,
} from '@app/auth/session-coordination/session-marker';
import { findMockUserByEmail, setMockSessionUser, toMockPublicUser } from '@app/mocks/data';
import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { renderAppAtRoute } from '@app/test/renderAppAtRoute';
import { deferred } from '@app/test/session-environment';
import { server } from '@app/test/setup';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

/** A cache retirement failure blocks rendering until explicit retirement/Me Retry succeeds. */
async function testCacheRetirementRetry(): Promise<void> {
  const clear = vi
    .spyOn(ApolloClient.prototype, 'clearStore')
    .mockRejectedValueOnce(new Error('Controlled cache failure'));

  try {
    renderAppAtRoute('/corrections');
    expect(
      await screen.findByText('Authentication is temporarily unavailable. Please retry.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  } finally {
    clear.mockRestore();
  }
}

/** Expected login rejection survives provider retirement without exposing the rejected identity. */
async function testExpectedRejection(): Promise<void> {
  const user = userEvent.setup();
  renderAppAtRoute('/signin');
  await user.type(
    await screen.findByRole('textbox', { name: 'Email' }),
    defaultMockReviewerCredentials.email,
  );
  await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(
    await screen.findByText('Could not sign you in. Check your email and password and try again.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
}

/** Typed completed outcomes retain suppression until explicit revocation, not Me Retry. */
async function testExplicitRevocationRecovery(): Promise<void> {
  window.localStorage.setItem(
    SESSION_MARKER_KEY,
    JSON.stringify({
      ...INITIAL_SESSION_MARKER,
      epoch: crypto.randomUUID(),
      logoutIntent: true,
      revocation: 'unconfirmed',
    }),
  );
  const me = vi.fn(
    /** A typed Me response counts any forbidden bootstrap during logout recovery. */
    () => HttpResponse.json<{ data: MeQuery }>({ data: { me: null } }),
  );
  const signOut = vi.fn(
    /** Keeps the mock payload while typing its selected fields against the generated operation. */
    () => {
      const data = { signOut: { __typename: 'SignOutPayload', success: true } };
      return HttpResponse.json<{ data: SignOutMutation }>({ data });
    },
  );
  server.use(graphql.query('Me', me), graphql.mutation('SignOut', signOut));
  renderAppAtRoute('/corrections');
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry sign out' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  expect(me).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalledTimes(1);
}

/** Logout hints retire delayed bootstrap even if their event payload claims an older anonymous epoch. */
async function testLateBootstrap(): Promise<void> {
  const started = deferred<void>();
  const response = deferred<void>();
  const record = findMockUserByEmail(defaultMockReviewerCredentials.email)!;
  server.use(
    graphql.query(
      'Me',
      /** Holds an old user projection until logout suppression is durable. */
      async () => {
        started.resolve();
        await response.promise;
        return HttpResponse.json({ data: { me: toMockPublicUser(record) } });
      },
    ),
  );
  renderAppAtRoute('/corrections');
  await started.promise;
  await act(
    /** Simulates a peer notification whose payload is deliberately stale. */
    async () => {
      window.localStorage.setItem(
        SESSION_MARKER_KEY,
        JSON.stringify({
          ...INITIAL_SESSION_MARKER,
          epoch: crypto.randomUUID(),
          logoutIntent: true,
          revocation: 'confirmed',
        }),
      );
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_MARKER_KEY,
          newValue: JSON.stringify(INITIAL_SESSION_MARKER),
        }),
      );
      response.resolve();
      await response.promise;
    },
  );
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
}

/** Unknown durable writes suppress a typed Me handler after reload and offer no blind retry. */
async function testSuppressedReload(): Promise<void> {
  const id = crypto.randomUUID();
  window.localStorage.setItem(
    SESSION_MARKER_KEY,
    JSON.stringify({
      ...INITIAL_SESSION_MARKER,
      action: { id, kind: 'sign-out', status: 'unknown' },
      epoch: id,
      logoutIntent: true,
      revocation: 'unconfirmed',
    }),
  );
  const me = vi.fn(
    /** Counts unexpected authentication with the generated GraphQL response shape. */
    () => HttpResponse.json<{ data: MeQuery }>({ data: { me: null } }),
  );
  server.use(graphql.query('Me', me));
  renderAppAtRoute('/corrections');
  expect(await screen.findByText(/An account action is unresolved/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry sign out' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
  expect(me).not.toHaveBeenCalled();
}

/** Unsupported browsers can view valid sessions but never dispatch the typed sign-out handler. */
async function testUnsupportedLocalLogout(): Promise<void> {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  const record = findMockUserByEmail(defaultMockReviewerCredentials.email)!;
  setMockSessionUser(record.id);
  const signOut = vi.fn(
    /** Any sign-out matching this generated response shape violates the no-Locks safeguard. */
    () => HttpResponse.json<{ data: SignOutMutation }>({ data: { signOut: { success: true } } }),
  );
  server.use(graphql.mutation('SignOut', signOut));
  const view = renderAppAtRoute('/corrections');
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Correction inbox' }),
  ).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /CT|Correction Tester/ }));
  await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(await screen.findByText(/server revocation could not be confirmed/)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
  view.unmount();
  renderAppAtRoute('/corrections');
  expect(await screen.findByText(/server revocation could not be confirmed/)).toBeInTheDocument();
  expect(signOut).not.toHaveBeenCalled();
}

describe('session resilience integration' /** Covers React/provider/transport behavior; shared HttpOnly-cookie ordering remains live acceptance. */, () => {
  it('suppresses bootstrap after unresolved logout and reload', testSuppressedReload);
  it(
    'offers explicit revocation recovery only for completed outcomes',
    testExplicitRevocationRecovery,
  );
  it('keeps no-Locks logout local and durable', testUnsupportedLocalLogout);
  it('drops a delayed bootstrap after durable peer logout', testLateBootstrap);
  it('preserves expected login rejection feedback', testExpectedRejection);
  it('keeps content blocked when cache retirement fails', testCacheRetirementRetry);
});
