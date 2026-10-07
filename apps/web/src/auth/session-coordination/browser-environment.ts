import { AUTH_LOCK_DEADLINE_MS, SESSION_MARKER_KEY } from './session-marker';

export interface SessionEnvironment {
  listen: (changed: () => void) => () => void;
  notify: () => void;
  read: () => null | string;
  uuid: () => string;
  withLock?: SessionLock;
  write: (record: string) => void;
}

export type SessionLock = <T>(name: string, work: () => Promise<T> | T) => Promise<T>;

/** Adapts browser primitives without reading credentials or constructing a storage mutex. */
export function createBrowserSessionEnvironment(): SessionEnvironment {
  let channel: BroadcastChannel | undefined;
  const locks = navigator.locks;
  return {
    /** Treats peer messages only as hints to reread the validated record. */
    listen(changed) {
      /** Storage deletion is also relevant; never trust an event's stale newValue. */
      function storageChanged(event: StorageEvent): void {
        if (event.key === null || event.key === SESSION_MARKER_KEY) {
          changed();
        }
      }
      window.addEventListener('storage', storageChanged);

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          channel = new BroadcastChannel(SESSION_MARKER_KEY);
          channel.addEventListener('message', changed);
        }
      } catch {
        // Storage events remain sufficient notification; neither channel owns state.
      }
      /** Removes tab subscriptions on unmount, including StrictMode cleanup. */
      return () => {
        window.removeEventListener('storage', storageChanged);
        channel?.close();
        channel = undefined;
      };
    },
    /** Announces a change without broadcasting identity or marker payloads. */
    notify() {
      try {
        channel?.postMessage(null);
      } catch {
        // A missed hint cannot override the next mandatory storage reread.
      }
    },
    /** Defers storage access so unavailable storage fails closed at the coordinator. */
    read: () => window.localStorage.getItem(SESSION_MARKER_KEY),
    /** Uses only random non-secret action identifiers. */
    uuid: () => crypto.randomUUID(),
    withLock: locks
      ? /** Adapts native Locks without changing their queue or ownership semantics. */
        <T>(name: string, work: () => Promise<T> | T): Promise<T> =>
          withBrowserLock(locks, name, work)
      : undefined,
    /** Persists only the strict, bounded non-secret coordination record. */
    write: (record) => window.localStorage.setItem(SESSION_MARKER_KEY, record),
  };
}

/** Fails closed rather than installing a weaker cross-tab mutex. */
export function requireSessionLock(environment: SessionEnvironment): SessionLock {
  if (!environment.withLock) {
    throw new Error('This browser cannot safely change accounts. Web Locks are required.');
  }

  return environment.withLock;
}

/** Bounds acquisition only; holds synchronous or asynchronous work until it settles. */
async function withBrowserLock<T>(
  locks: LockManager,
  name: string,
  work: () => Promise<T> | T,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    /** Rejects queue acquisition without dispatching a cookie request. */
    () => controller.abort(),
    AUTH_LOCK_DEADLINE_MS,
  );

  try {
    return await locks.request(
      name,
      { signal: controller.signal },
      /** Releases the acquisition deadline before executing protected work. */
      async () => {
        clearTimeout(timer);
        return await work();
      },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Another account action is busy. Please retry.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
