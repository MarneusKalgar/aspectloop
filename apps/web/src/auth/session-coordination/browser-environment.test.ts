import { describe, expect, it, vi } from 'vitest';

import { createQueuedTestLocks, deferred } from '../../test/session-environment';
import { createBrowserSessionEnvironment } from './browser-environment';
import { SessionCoordinator } from './session-coordinator';
import {
  AUTH_LOCK_DEADLINE_MS,
  INITIAL_SESSION_MARKER,
  SESSION_COOKIE_LOCK,
  SESSION_MARKER_KEY,
} from './session-marker';
import { clearLegacyBrowserCookie } from './SessionCoordinatorProvider';

/** Acquisition timeout retains its cause without releasing the held lock or dispatching work. */
async function testAcquisitionDeadline(): Promise<void> {
  vi.useFakeTimers();

  try {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: createQueuedTestLocks(),
    });
    const environment = createBrowserSessionEnvironment();
    const held = deferred<void>();
    const entered = deferred<void>();
    const first = environment.withLock!(
      SESSION_COOKIE_LOCK,
      /** Holds the actual queue while a second caller reaches its acquisition deadline. */
      async () => {
        entered.resolve();
        await held.promise;
      },
    );
    await entered.promise;
    const work = vi.fn().mockResolvedValue(undefined);
    const queued = environment.withLock!(SESSION_COOKIE_LOCK, work);
    const timedOut = expect(queued).rejects.toThrow(/busy.*retry/i);
    await vi.advanceTimersByTimeAsync(AUTH_LOCK_DEADLINE_MS);
    await timedOut;
    await expect(queued).rejects.toMatchObject({ cause: { name: 'AbortError' } });
    expect(work).not.toHaveBeenCalled();
    held.resolve();
    await first;
    expect(work).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
}

/** Exact historical cleanup never targets the active session or unrelated cookie names. */
function testLegacyTombstone(): void {
  document.cookie = 'aspectloop_access_token=obsolete; Path=/';
  document.cookie = 'aspectloop_session=active-test-cookie; Path=/';
  document.cookie = 'unrelated=keep; Path=/';

  try {
    clearLegacyBrowserCookie();
    expect(document.cookie).not.toContain('aspectloop_access_token');
    expect(document.cookie).toContain('aspectloop_session=active-test-cookie');
    expect(document.cookie).toContain('unrelated=keep');
  } finally {
    document.cookie = 'aspectloop_session=; Path=/; Max-Age=0';
    document.cookie = 'unrelated=; Path=/; Max-Age=0';
  }
}

/** A stale event payload cannot remove the newer durable logout when BroadcastChannel is absent. */
function testStorageHints(): void {
  vi.stubGlobal('BroadcastChannel', undefined);

  try {
    const coordinator = new SessionCoordinator(createBrowserSessionEnvironment());
    const dispose = coordinator.start();
    const current = {
      ...INITIAL_SESSION_MARKER,
      epoch: crypto.randomUUID(),
      logoutIntent: true,
      revocation: 'confirmed',
    };
    window.localStorage.setItem(SESSION_MARKER_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SESSION_MARKER_KEY,
        newValue: JSON.stringify(INITIAL_SESSION_MARKER),
      }),
    );
    expect(coordinator.canRead()).toBe(false);
    dispose();
    window.localStorage.setItem(
      SESSION_MARKER_KEY,
      JSON.stringify({ ...INITIAL_SESSION_MARKER, epoch: crypto.randomUUID() }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_MARKER_KEY }));
    expect(coordinator.canRead()).toBe(false);
    const remount = coordinator.start();
    expect(coordinator.canRead()).toBe(true);
    remount();
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('browser coordination adapter' /** Tests bounded acquisition, hint-only events, and proven-cookie ownership. */, () => {
  it('bounds waiting acquisition without releasing the live owner', testAcquisitionDeadline);
  it('rereads storage instead of accepting delayed event data', testStorageHints);
  it('clears only the proven legacy cookie', testLegacyTombstone);
});
