import type { SessionEnvironment } from '../auth/session-coordination/browser-environment';

import { createQueuedTestLocks } from './session-locks';

export { createQueuedTestLocks } from './session-locks';

interface SharedSessionEnvironment {
  environment: (supported?: boolean) => SessionEnvironment;
  listeners: Set<() => void>;
  raw: null | string;
  readFails: boolean;
  writeFails: boolean;
}

/** Shares only a marker and lock queues between isolated coordinator instances. */
export function createSharedSessionEnvironment(): SharedSessionEnvironment {
  const listeners = new Set<() => void>();
  const locks = createQueuedTestLocks();
  const shared: SharedSessionEnvironment = {
    /** Creates one tab's injectable adapter over the shared non-secret test storage. */
    environment(supported = true): SessionEnvironment {
      return {
        /** Adds a peer notification listener and returns its exact teardown. */
        listen(changed) {
          listeners.add(changed);
          /** Removes this tab without disturbing peer subscriptions. */
          return () => {
            listeners.delete(changed);
          };
        },
        /** Sends payload-free hints to subscribed tabs. */
        notify() {
          for (const listener of listeners) {
            listener();
          }
        },
        /** Simulates browser storage denial without using real credentials. */
        read() {
          if (shared.readFails) {
            throw new Error('Storage denied');
          }
          return shared.raw;
        },
        /** Generates non-secret, schema-valid identifiers for each test action. */
        uuid: () => crypto.randomUUID(),
        withLock: supported
          ? /** Uses the shared exclusive test queue for both distinct lock names. */
            (name, work) => locks.request(name, {}, work)
          : undefined,
        /** Simulates bounded marker writes or denied browser persistence. */
        write(record) {
          if (shared.writeFails) {
            throw new Error('Storage denied');
          }
          shared.raw = record;
        },
      };
    },
    listeners,
    raw: null,
    readFails: false,
    writeFails: false,
  };
  return shared;
}

/** Creates explicit test barriers instead of relying on arbitrary network sleeps. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>(
    /** Exposes resolution only to the scenario controlling this barrier. */
    (accept, fail) => {
      resolve = accept;
      reject = fail;
    },
  );
  return { promise, reject, resolve };
}
