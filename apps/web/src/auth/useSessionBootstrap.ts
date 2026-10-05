import type { ApolloClient } from '@apollo/client/core';

import { useApolloClient } from '@apollo/client/react';
import { useEffect, useState } from 'react';

import type {
  CoordinationSnapshot,
  SessionCoordinator,
} from './session-coordination/session-coordinator';

import { useMeQuery } from '../graphql/hooks/auth';
import { AUTH_REQUEST_DEADLINE_MS } from './session-coordination/session-marker';
import { isInvalidSessionError } from './session-error';
import { ANONYMOUS_SESSION, type SessionResolution } from './session-view';
import { BROWSER_AUTH_STATUS } from './session.types';

interface BootstrapRequest {
  client: ApolloClient;
  coordinator: SessionCoordinator;
  failure: CoordinationSnapshot['failure'];
  loadMe: ReturnType<typeof useMeQuery>;
  resolve: (resolution: SessionResolution) => void;
  revision: number;
  signal: AbortSignal;
}

/** Owns bootstrap effect lifetime and pending-owner inspection, not rendered session policy. */
export function useSessionBootstrap(
  coordinator: SessionCoordinator,
  snapshot: CoordinationSnapshot,
): SessionResolution {
  const client = useApolloClient();
  const loadMe = useMeQuery();
  const [resolution, setResolution] = useState<SessionResolution>({
    kind: 'pending',
    revision: -1,
  });
  const { failure, revision } = snapshot;
  const pending = snapshot.marker?.action?.status === 'pending';

  useEffect(
    /** Starts work only after surviving StrictMode's initial effect cleanup. */
    () => {
      const controller = new AbortController();
      queueMicrotask(
        /** Defers cache/network work until the committed effect is still live. */
        () => {
          if (!controller.signal.aborted) {
            void reconcileSession({
              client,
              coordinator,
              failure,
              loadMe,
              resolve: setResolution,
              revision,
              signal: controller.signal,
            });
          }
        },
      );
      /** Retires this bootstrap's delivery when its revision or mounted owner changes. */
      return () => controller.abort();
    },
    [client, coordinator, loadMe, revision, failure],
  );

  useEffect(
    /** Lock acquisition can detect an orphan but cannot establish remote rollback. */
    () => {
      if (pending) {
        void coordinator.inspectPending().catch(
          /** Inspection failure retains the existing blocking state. */
          () => undefined,
        );
      }
    },
    [coordinator, pending],
  );
  return resolution;
}

/** Retires cache before Me and checks cancellation/revision at every publication boundary. */
async function reconcileSession({
  client,
  coordinator,
  failure,
  loadMe,
  resolve,
  revision,
  signal,
}: BootstrapRequest): Promise<void> {
  try {
    await client.clearStore();
  } catch {
    if (!signal.aborted && coordinator.isCurrent(revision)) {
      resolve({ kind: 'cache-failed', revision });
    }
    return;
  }

  if (signal.aborted || !coordinator.isCurrent(revision)) {
    return;
  }

  if (!coordinator.canRead() || failure) {
    resolve({ kind: 'resolved', revision, session: ANONYMOUS_SESSION });
    return;
  }

  try {
    const user = await loadMe(
      AbortSignal.any([signal, AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS)]),
    );

    if (signal.aborted || !coordinator.accepts(revision)) {
      return;
    }

    if (!user) {
      coordinator.fail('unavailable', revision);
      return;
    }

    resolve({
      kind: 'resolved',
      revision,
      session: { status: BROWSER_AUTH_STATUS.AUTHENTICATED, user },
    });
  } catch (error) {
    if (!signal.aborted && coordinator.accepts(revision)) {
      coordinator.fail(isInvalidSessionError(error) ? 'invalid' : 'unavailable', revision);
    }
  }
}
