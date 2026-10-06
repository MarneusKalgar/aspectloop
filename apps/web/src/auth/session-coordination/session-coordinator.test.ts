import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { describe, expect, it, vi } from 'vitest';

import { createSharedSessionEnvironment, deferred } from '../../test/session-environment';
import {
  SessionCoordinator,
  SessionOperationCancelledError,
  SessionSignInRejectedError,
} from './session-coordinator';
import {
  AUTH_REQUEST_DEADLINE_MS,
  INITIAL_SESSION_MARKER,
  parseSessionMarker,
  SESSION_COOKIE_LOCK,
} from './session-marker';

/** Cache failure keeps its Error identity without preventing revocation or reopening old data. */
async function testCacheFailure(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const request = vi.fn().mockResolvedValue(undefined);
  const cacheError = new Error('Cache failure');
  await expect(coordinator.signOut(request, vi.fn().mockRejectedValue(cacheError))).rejects.toBe(
    cacheError,
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(parseSessionMarker(shared.raw).revocation).toBe('confirmed');
  expect(coordinator.canRead()).toBe(false);
}

/** A dispatched completed logout failure stays blocked even when a cookie-less retry would succeed. */
async function testCompletedFailure(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const completed = new CombinedGraphQLErrors({
    errors: [{ extensions: { code: 'AUTH_DEPENDENCY_UNAVAILABLE' }, message: 'Unavailable' }],
  });

  await expect(
    coordinator.signOut(vi.fn().mockRejectedValue(completed), vi.fn().mockResolvedValue(undefined)),
  ).rejects.toBe(completed);

  expect(parseSessionMarker(shared.raw)).toMatchObject({
    action: { kind: 'sign-out', status: 'failed' },
    logoutIntent: true,
    revocation: 'unconfirmed',
  });

  const reopened = new SessionCoordinator(shared.environment());
  const retry = vi.fn().mockResolvedValue(undefined);
  const login = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const blocked = shared.raw;

  expect(reopened.canRead()).toBe(false);
  expect(reopened.canRegister()).toBe(false);

  await reopened.inspectPending();
  await expect(reopened.signOut(retry, cleanup)).rejects.toThrow(/unresolved/);
  await expect(reopened.signIn(login)).rejects.toThrow(/confirmed/);

  expect(retry).not.toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(shared.raw).toBe(blocked);
  expect(reopened.canRead()).toBe(false);
}

/** Non-Error failures retain causes, including falsy values, without bypassing logout safety. */
async function testDeferredErrorCauses(): Promise<void> {
  const denied = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator({
    ...denied.environment(),
    withLock: vi.fn().mockRejectedValue(false),
  });
  const request = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn().mockResolvedValue(undefined);
  await expect(coordinator.signOut(request, cleanup)).rejects.toMatchObject({
    cause: false,
    message: 'Session coordination storage is unavailable.',
  });
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  expect(coordinator.canRead()).toBe(false);

  const shared = createSharedSessionEnvironment();
  const current = new SessionCoordinator(shared.environment());
  await expect(current.signOut(request, vi.fn().mockRejectedValue(null))).rejects.toMatchObject({
    cause: null,
    message: 'Session cache retirement failed.',
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(parseSessionMarker(shared.raw).revocation).toBe('confirmed');
  expect(current.canRead()).toBe(false);
}

/** An old logout paused in cache cleanup must not clear a later explicitly established account. */
async function testDelayedOldLogout(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const first = new SessionCoordinator(shared.environment());
  const second = new SessionCoordinator(shared.environment());
  const current = new SessionCoordinator(shared.environment());
  const started = deferred<void>();
  const acknowledgement = deferred<void>();
  const cleanupStarted = deferred<void>();
  const cleanup = deferred<void>();
  const logout = first.signOut(
    /** Holds the first revocation response while a second explicit intent is published. */
    () => {
      started.resolve();
      return acknowledgement.promise;
    },
    vi.fn().mockResolvedValue(undefined),
  );
  await started.promise;
  const oldRequest = vi.fn().mockResolvedValue(undefined);
  const delayed = second.signOut(
    oldRequest,
    /** Pauses this older logout before it can join the cookie-lock queue. */
    async () => {
      cleanupStarted.resolve();
      await cleanup.promise;
    },
  );
  await cleanupStarted.promise;
  acknowledgement.resolve();
  await logout;
  await current.signIn(vi.fn().mockResolvedValue(undefined));
  const epoch = parseSessionMarker(shared.raw).epoch;
  cleanup.resolve();
  await delayed;
  expect(oldRequest).not.toHaveBeenCalled();
  expect(parseSessionMarker(shared.raw)).toMatchObject({ epoch, logoutIntent: false });
}

/** Event payloads never grant access; teardown/remount and observed marker deletion remain safe. */
async function testEventLifecycle(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const first = new SessionCoordinator(shared.environment());
  const peer = new SessionCoordinator(shared.environment());
  const dispose = peer.start();
  expect(shared.listeners.size).toBe(1);
  await first.signOut(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined));
  expect(peer.canRead()).toBe(false);
  shared.raw = null;
  shared.environment().notify();
  expect(peer.getSnapshot().marker).toBeNull();
  dispose();
  const remount = peer.start();
  expect(shared.listeners.size).toBe(1);
  remount();
  expect(shared.listeners.size).toBe(0);
}

/** Failed persistence keeps local suppression; restoring writes permits the first, not a replayed, logout. */
async function testFailedLogoutWriteRecovery(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());

  await coordinator.signIn(vi.fn().mockResolvedValue(undefined));

  const original = shared.raw;
  const request = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn().mockResolvedValue(undefined);
  shared.writeFails = true;

  await expect(coordinator.signOut(request, cleanup)).rejects.toThrow(/storage/);

  expect(coordinator.getSnapshot()).toMatchObject({ localLogout: true, marker: null });
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(shared.raw).toBe(original);

  // Bootstrap rereads the unchanged record; this restores marker validity, not local access.
  coordinator.refresh();

  expect(coordinator.getSnapshot()).toMatchObject({
    localLogout: true,
    marker: parseSessionMarker(original),
  });
  expect(coordinator.canRead()).toBe(false);
  expect(coordinator.canRegister()).toBe(false);
  expect(new SessionCoordinator(shared.environment()).canRead()).toBe(true);

  await expect(coordinator.signIn(request)).rejects.toBeInstanceOf(SessionOperationCancelledError);
  await expect(coordinator.signOut(request, cleanup)).rejects.toThrow(/storage/);

  expect(cleanup).toHaveBeenCalledTimes(2);
  expect(request).not.toHaveBeenCalled();
  expect(shared.raw).toBe(original);
  expect(coordinator.getSnapshot().localLogout).toBe(true);

  shared.writeFails = false;

  await coordinator.signOut(request, cleanup);

  expect(request).toHaveBeenCalledTimes(1);
  expect(parseSessionMarker(shared.raw).revocation).toBe('confirmed');
  expect(coordinator.canRead()).toBe(false);
}

/** Even a transport ignoring abort cannot clear uncertainty after the request deadline. */
async function testIgnoredAbort(): Promise<void> {
  vi.useFakeTimers();

  try {
    const shared = createSharedSessionEnvironment();
    const coordinator = new SessionCoordinator(shared.environment());
    const started = deferred<void>();
    const response = deferred<void>();
    const login = coordinator.signIn(
      /** Models an adapter whose pending response ignores JavaScript cancellation. */
      () => {
        started.resolve();
        return response.promise;
      },
    );
    const rejection = expect(login).rejects.toThrow(/timed out/);
    await started.promise;
    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_DEADLINE_MS);
    await rejection;
    const unknown = shared.raw;
    response.resolve();
    await response.promise;
    expect(shared.raw).toBe(unknown);
    expect(coordinator.canRead()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
}

/** Legacy action-null intent cannot be rewritten into permission to retry a credential-losing logout. */
async function testLegacyLogoutFailure(): Promise<void> {
  const shared = createSharedSessionEnvironment();

  shared.raw = JSON.stringify({
    ...INITIAL_SESSION_MARKER,
    epoch: crypto.randomUUID(),
    logoutIntent: true,
    revocation: 'unconfirmed',
  });

  const blocked = shared.raw;
  const coordinator = new SessionCoordinator(shared.environment());
  const request = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn().mockResolvedValue(undefined);

  await expect(coordinator.signOut(request, cleanup)).rejects.toThrow(/unresolved/);
  await expect(coordinator.signIn(request)).rejects.toThrow(/confirmed/);

  expect(shared.raw).toBe(blocked);
  expect(request).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(coordinator.canRead()).toBe(false);
  expect(coordinator.canRegister()).toBe(false);
}

/** Logout publishes intent during a delayed login and orders explicit revocation after its response. */
async function testLogoutWins(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const first = new SessionCoordinator(shared.environment());
  const second = new SessionCoordinator(shared.environment());
  const started = deferred<void>();
  const response = deferred<void>();
  const retired = deferred<void>();
  const login = first.signIn(
    /** Delays cookie acknowledgement until both tabs observe logout intent. */
    () => {
      started.resolve();
      return response.promise;
    },
  );
  const rejected = expect(login).rejects.toBeInstanceOf(SessionOperationCancelledError);
  await started.promise;
  const serverSignOut = vi.fn().mockResolvedValue(undefined);
  const logout = second.signOut(
    serverSignOut,
    /** Signals that durable suppression preceded local cache retirement. */
    async () => retired.resolve(),
  );
  await retired.promise;
  first.refresh();
  expect(first.canRead()).toBe(false);
  expect(second.canRead()).toBe(false);
  expect(parseSessionMarker(shared.raw).logoutIntent).toBe(true);
  expect(serverSignOut).not.toHaveBeenCalled();
  response.resolve();
  await rejected;
  await logout;
  expect(serverSignOut).toHaveBeenCalledTimes(1);
  expect(parseSessionMarker(shared.raw)).toMatchObject({
    action: null,
    logoutIntent: true,
    revocation: 'confirmed',
  });
}

/** Rejects unbounded, incompatible, inconsistent, or secret-bearing coordination records. */
function testMarkerValidation(): void {
  expect(parseSessionMarker(null)).toEqual(INITIAL_SESSION_MARKER);

  for (const raw of [
    '{',
    'x'.repeat(1025),
    JSON.stringify({ ...INITIAL_SESSION_MARKER, version: 2 }),
    JSON.stringify({ ...INITIAL_SESSION_MARKER, email: 'private@example.test' }),
    JSON.stringify({ ...INITIAL_SESSION_MARKER, logoutIntent: true }),
  ]) {
    expect(
      /** Exercises the production parser against this incompatible record. */
      () => parseSessionMarker(raw),
    ).toThrow();
  }
}

/** Released ownerless pending markers become unknown once, not permission to dispatch recovery. */
async function testOrphan(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const id = crypto.randomUUID();
  shared.raw = JSON.stringify({
    ...INITIAL_SESSION_MARKER,
    action: { id, kind: 'sign-in', status: 'pending' },
    epoch: id,
  });
  const coordinator = new SessionCoordinator(shared.environment());
  await coordinator.inspectPending();
  expect(parseSessionMarker(shared.raw)).toMatchObject({
    action: { status: 'unknown' },
    logoutIntent: true,
  });
  const unknown = shared.raw;
  await coordinator.inspectPending();
  expect(shared.raw).toBe(unknown);
}

/** A failed cookie-lock acquisition leaves provable pre-dispatch intent retryable after reload. */
async function testPreDispatchRecovery(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const environment = shared.environment();
  const coordinator = new SessionCoordinator({
    ...environment,
    /** Fails only account-action acquisition; marker persistence remains real in the test adapter. */
    withLock(name, work) {
      if (name === SESSION_COOKIE_LOCK) {
        return Promise.reject(new Error('Cookie lock acquisition failed'));
      }

      return environment.withLock!(name, work);
    },
  });
  const request = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn().mockResolvedValue(undefined);

  await expect(coordinator.signOut(request, cleanup)).rejects.toThrow(/acquisition/);

  expect(request).not.toHaveBeenCalled();
  expect(parseSessionMarker(shared.raw)).toMatchObject({
    action: { kind: 'sign-out', status: 'ready' },
    logoutIntent: true,
    revocation: 'unconfirmed',
  });

  const reopened = new SessionCoordinator(shared.environment());

  await reopened.signOut(request, cleanup);

  expect(request).toHaveBeenCalledTimes(1);
  expect(parseSessionMarker(shared.raw).revocation).toBe('confirmed');

  await reopened.signIn(vi.fn().mockResolvedValue(undefined));

  expect(reopened.canRead()).toBe(true);
}

/** A queued second login must not overwrite the identity established by the first tab. */
async function testQueuedLogin(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const first = new SessionCoordinator(shared.environment());
  const second = new SessionCoordinator(shared.environment());
  const started = deferred<void>();
  const response = deferred<void>();
  const login = first.signIn(
    /** Holds the first cookie action at an explicit response barrier. */
    () => {
      started.resolve();
      return response.promise;
    },
  );
  await started.promise;
  const secondRequest = vi.fn().mockResolvedValue(undefined);
  const queued = second.signIn(secondRequest);
  const rejection = expect(queued).rejects.toBeInstanceOf(SessionOperationCancelledError);
  response.resolve();
  await login;
  await rejection;
  expect(secondRequest).not.toHaveBeenCalled();
  expect(parseSessionMarker(shared.raw).logoutIntent).toBe(false);
}

/** Wrong credentials after a confirmed logout retain normal retry permission through reload. */
async function testRejectedLoginAfterLogout(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const signOut = vi.fn().mockResolvedValue(undefined);
  const rejected = new CombinedGraphQLErrors({
    errors: [{ extensions: { code: 'AUTH_INVALID_CREDENTIALS' }, message: 'Rejected' }],
  });

  await coordinator.signOut(signOut, vi.fn().mockResolvedValue(undefined));
  await expect(coordinator.signIn(vi.fn().mockRejectedValue(rejected))).rejects.toBeInstanceOf(
    SessionSignInRejectedError,
  );

  expect(parseSessionMarker(shared.raw)).toMatchObject({
    action: null,
    logoutIntent: true,
    revocation: 'confirmed',
  });

  const reopened = new SessionCoordinator(shared.environment());

  expect(reopened.canRegister()).toBe(true);

  await reopened.signIn(vi.fn().mockResolvedValue(undefined));

  expect(reopened.canRead()).toBe(true);
  expect(signOut).toHaveBeenCalledTimes(1);
}

/** Storage denial prevents dispatch; local logout still hides access and attempts cleanup. */
async function testStorageFailure(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  shared.writeFails = true;
  const request = vi.fn();
  await expect(coordinator.signIn(request)).rejects.toThrow(/storage/);
  expect(coordinator.canRead()).toBe(false);
  const cleanup = vi.fn().mockResolvedValue(undefined);
  await expect(coordinator.signOut(request, cleanup)).rejects.toThrow(/storage/);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
}

/** A network rejection survives reload and cannot be reconciled by blind login or logout replay. */
async function testUnknownOutcome(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const first = new SessionCoordinator(shared.environment());
  await expect(
    first.signIn(vi.fn().mockRejectedValue(new TypeError('Network failure'))),
  ).rejects.toThrow();
  expect(parseSessionMarker(shared.raw)).toMatchObject({
    action: { status: 'unknown' },
    logoutIntent: true,
  });
  const reopened = new SessionCoordinator(shared.environment());
  expect(reopened.canRead()).toBe(false);
  const login = vi.fn();
  const logout = vi.fn();
  const cleanup = vi.fn().mockResolvedValue(undefined);
  await expect(reopened.signIn(login)).rejects.toThrow();
  await expect(reopened.signOut(logout, cleanup)).rejects.toThrow(/unresolved/);
  expect(login).not.toHaveBeenCalled();
  expect(logout).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
}

/** Lack of native Locks allows read-only bootstrap and durable local logout, but no cookie action. */
async function testUnsupportedLocks(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment(false));
  expect(coordinator.canRead()).toBe(true);
  const request = vi.fn();
  const cleanup = vi.fn().mockResolvedValue(undefined);
  await expect(coordinator.signIn(request)).rejects.toThrow(/Web Locks/);
  await expect(coordinator.signOut(request, cleanup)).rejects.toThrow(/Web Locks/);
  expect(request).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(new SessionCoordinator(shared.environment(false)).canRead()).toBe(false);
}

describe('browser session coordination' /** Covers cross-tab ordering, bounded uncertainty, and fail-closed persistence. */, () => {
  it('validates the bounded non-secret marker', testMarkerValidation);
  it('rejects a queued superseded login before dispatch', testQueuedLogin);
  it('makes logout intent win against delayed login', testLogoutWins);
  it('preserves unknown outcomes through reload', testUnknownOutcome);
  it('does not accept late completion after timeout', testIgnoredAbort);
  it('marks orphaned actions unknown without repeated writes', testOrphan);
  it('requires reset after a completed dispatched logout failure', testCompletedFailure);
  it('blocks retry of legacy ambiguous logout intent', testLegacyLogoutFailure);
  it('permits retry after failure before cookie dispatch', testPreDispatchRecovery);
  it(
    'permits login retry after confirmed logout and expected rejection',
    testRejectedLoginAfterLogout,
  );
  it('does not mutate cookies without native Locks', testUnsupportedLocks);
  it('blocks account dispatch when storage fails', testStorageFailure);
  it(
    'keeps failed logout writes locally suppressed after a valid reread',
    testFailedLogoutWriteRecovery,
  );
  it('still revokes when cache retirement fails', testCacheFailure);
  it('preserves deferred error causes and rejects falsy failures', testDeferredErrorCauses);
  it('does not dispatch a delayed old logout against a newer login', testDelayedOldLogout);
  it('disposes hints and rejects live marker deletion', testEventLifecycle);
});
