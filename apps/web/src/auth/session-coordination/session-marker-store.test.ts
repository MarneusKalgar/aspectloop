import { describe, expect, it, vi } from 'vitest';

import type { SessionLock } from './browser-environment';

import { createSharedSessionEnvironment } from '../../test/session-environment';
import { SESSION_MARKER_LOCK } from './session-marker';
import { SessionMarkerStore } from './session-marker-store';
import { beginSignIn, publishLogoutIntent } from './session-marker-transitions';

const id = '00000000-0000-4000-8000-000000000001';

describe('validated marker storage' /** Covers the extracted trust boundary independently of account orchestration. */, () => {
  it('publishes valid state before peer hints and uses only the marker lock' /** Network/cache ownership never moves into storage updates. */, async () => {
    const shared = createSharedSessionEnvironment();
    const environment = shared.environment();
    const events: string[] = [];
    const changed = vi.fn(
      /** Records local invalidation before any peer receives a hint. */
      () => events.push('published'),
    );
    /** Awaits protected sync/async storage work without fabricating a cookie lock owner. */
    const lock: SessionLock = async <T>(name: string, work: () => Promise<T> | T): Promise<T> => {
      events.push(name);
      return await work();
    };
    const store = new SessionMarkerStore(
      {
        ...environment,
        /** Models a payload-free peer hint. */
        notify() {
          events.push('notified');
        },
        withLock: lock,
      },
      changed,
    );
    store.refresh();
    events.length = 0;
    await store.update(
      /** Records a valid pending action under the storage lock. */
      (marker) => beginSignIn(marker, id),
    );
    expect(events).toEqual([SESSION_MARKER_LOCK, 'published', 'notified']);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ epoch: id }));
    events.length = 0;
    await store.update(
      /** A no-op transition preserves storage and sends no peer hint. */
      (marker) => ({ marker, result: undefined }),
    );
    expect(events).toEqual([SESSION_MARKER_LOCK]);
  });

  it('blocks deletion, corruption, and denied storage instead of restoring initial access' /** Only a genuinely new instance may interpret absent storage as initial state. */, async () => {
    const shared = createSharedSessionEnvironment();
    const changed = vi.fn();
    const store = new SessionMarkerStore(shared.environment(), changed);
    store.refresh();
    await store.update(
      /** Establishes durable logout intent before simulating storage loss. */
      (marker) => publishLogoutIntent(marker, id),
    );
    shared.raw = null;
    store.refresh();
    expect(changed).toHaveBeenLastCalledWith(null);
    await expect(
      store.update(
        /** A new login cannot reopen a removed marker in this instance. */
        (marker) => beginSignIn(marker, id),
      ),
    ).rejects.toThrow(/storage is unavailable/);
    shared.raw = '{invalid';
    store.refresh();
    expect(changed).toHaveBeenLastCalledWith(null);
    shared.readFails = true;
    await expect(
      store.update(
        /** Denied reads must not grant permission for a marker write. */
        (marker) => publishLogoutIntent(marker, id),
      ),
    ).rejects.toThrow(/storage is unavailable/);
  });

  it('permits only local suppression without Locks and invalidates failed writes' /** Missing capabilities cannot become a fallback account-action mutex. */, async () => {
    const shared = createSharedSessionEnvironment();
    const changed = vi.fn();
    const store = new SessionMarkerStore(shared.environment(false), changed);
    store.refresh();
    await expect(
      store.update(
        /** Account actions cannot record or dispatch without native Locks. */
        (marker) => beginSignIn(marker, id),
      ),
    ).rejects.toThrow(/Web Locks are required/);
    expect(shared.raw).toBeNull();
    await store.update(
      /** Local logout still publishes non-secret durable suppression. */
      (marker) => publishLogoutIntent(marker, id),
      true,
    );
    shared.writeFails = true;
    await expect(
      store.update(
        /** Failed suppression writes retire local access rather than claiming success. */
        (marker) => publishLogoutIntent(marker, id),
        true,
      ),
    ).rejects.toThrow(/storage is unavailable/);
    expect(changed).toHaveBeenLastCalledWith(null);
  });
});
