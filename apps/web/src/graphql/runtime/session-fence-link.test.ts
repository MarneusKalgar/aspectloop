import { ApolloClient, ApolloLink, gql, InMemoryCache, Observable } from '@apollo/client/core';
import { describe, expect, it, vi } from 'vitest';

import {
  SessionCoordinator,
  SessionOperationCancelledError,
} from '../../auth/session-coordination/session-coordinator';
import { createSharedSessionEnvironment, deferred } from '../../test/session-environment';
import { createGraphqlClient } from './createGraphqlClient';
import { createSessionFenceLink } from './session-fence-link';

const accountQuery = gql`
  query AccountData {
    account {
      id
      label
    }
  }
`;
interface TransportObserver {
  complete: () => void;
  error: (error: unknown) => void;
  next: (result: ApolloLink.Result) => void;
}

/** Cookie action results stay uncached and locked even while logout retires ordinary Apollo work. */
async function testCookieActionBarrier(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const harness = transportHarness(coordinator);
  const retired = deferred<void>();
  const login = coordinator.signIn(
    /** Matches the imperative no-cache SignIn executor used by AuthProvider. */
    async (signal) => {
      await harness.client.mutate({
        context: { fetchOptions: { signal }, sessionCookieAction: true },
        fetchPolicy: 'no-cache',
        mutation: gql`
          mutation SignIn {
            signIn {
              user {
                id
              }
            }
          }
        `,
      });
    },
  );
  const cancelled = expect(login).rejects.toBeInstanceOf(SessionOperationCancelledError);
  await vi.waitFor(
    /** Observes the cookie-changing request before publishing logout intent. */
    () => expect(harness.observers).toHaveLength(1),
  );
  const peer = new SessionCoordinator(shared.environment());
  const logout = peer.signOut(
    /** Matches the explicit no-cache SignOut executor under the same shared cookie lock. */
    async (signal) => {
      await harness.client.mutate({
        context: { fetchOptions: { signal }, sessionCookieAction: true },
        fetchPolicy: 'no-cache',
        mutation: gql`
          mutation SignOut {
            signOut {
              success
            }
          }
        `,
      });
    },
    /** Clears Apollo without treating that cancellation as cookie-action completion. */
    async () => {
      await harness.client.clearStore();
      retired.resolve();
    },
  );
  await retired.promise;
  expect(harness.signals[0].aborted).toBe(false);
  expect(harness.observers).toHaveLength(1);
  harness.observers[0].next({
    data: {
      signIn: { __typename: 'SignInPayload', user: { __typename: 'User', id: 'obsolete-A' } },
    },
  });
  harness.observers[0].complete();
  await cancelled;
  await vi.waitFor(
    /** Explicit revocation dispatches only after the earlier cookie action settles. */
    () => expect(harness.observers).toHaveLength(2),
  );
  harness.observers[1].next({ data: { signOut: { __typename: 'SignOutPayload', success: true } } });
  harness.observers[1].complete();
  await logout;
  expect(JSON.stringify(harness.client.cache.extract())).not.toContain('obsolete-A');
  expect(coordinator.canRead()).toBe(false);
  harness.client.stop();
}

/** Stable current session failures invalidate identity before their payload reaches cache. */
async function testCurrentSessionFailures(): Promise<void> {
  for (const [code, failure] of [
    ['AUTH_SESSION_INVALID', 'invalid'],
    ['AUTH_DEPENDENCY_UNAVAILABLE', 'unavailable'],
  ] as const) {
    const shared = createSharedSessionEnvironment();
    const coordinator = new SessionCoordinator(shared.environment());
    const harness = transportHarness(coordinator);
    const result = harness.client.query({ fetchPolicy: 'network-only', query: accountQuery });
    const cancelled = expect(result).rejects.toBeInstanceOf(SessionOperationCancelledError);
    await vi.waitFor(
      /** Observes current transport before supplying the controlled session error. */
      () => expect(harness.observers).toHaveLength(1),
    );
    harness.observers[0].next?.({
      data: null,
      errors: [{ extensions: { code }, message: 'Safe session failure' }],
    });
    await cancelled;
    expect(coordinator.getSnapshot().failure).toBe(failure);
    expect(shared.raw).toBeNull();
    harness.client.stop();
  }
}

/** Response-time storage rereading also fences mutations when peer notifications are absent. */
async function testMissedNotificationMutation(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const harness = transportHarness(coordinator);
  const result = harness.client.mutate({
    mutation: gql`
      mutation ProductEdit {
        edit {
          id
          label
        }
      }
    `,
  });
  const cancelled = expect(result).rejects.toBeInstanceOf(SessionOperationCancelledError);
  await vi.waitFor(
    /** Waits for the old mutation to be in flight before changing durable intent. */
    () => expect(harness.observers).toHaveLength(1),
  );
  const peer = new SessionCoordinator(shared.environment());
  await peer.signOut(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined));
  harness.observers[0].next?.({
    data: { edit: { __typename: 'Account', id: 'old', label: 'Stale edit' } },
  });
  await cancelled;
  expect(JSON.stringify(harness.client.cache.extract())).not.toContain('Stale edit');
  harness.client.stop();
}

/** A new identical query must dispatch independently instead of joining the cancelled generation. */
async function testNoCrossEpochDeduplication(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const harness = transportHarness(coordinator);
  const client = createGraphqlClient(coordinator);
  client.setLink(createSessionFenceLink(coordinator).concat(harness.network));
  const old = client.query({ fetchPolicy: 'network-only', query: accountQuery });
  const cancelled = expect(old).rejects.toBeInstanceOf(SessionOperationCancelledError);
  await vi.waitFor(
    /** Observes the old generation before explicitly switching accounts. */
    () => expect(harness.observers).toHaveLength(1),
  );
  await coordinator.signOut(
    vi.fn().mockResolvedValue(undefined),
    /** Retires all old normalized data without refetching. */
    async () => {
      await client.clearStore();
    },
  );
  await cancelled;
  await coordinator.signIn(vi.fn().mockResolvedValue(undefined));
  const current = client.query({ fetchPolicy: 'network-only', query: accountQuery });
  await vi.waitFor(
    /** Confirms a second transport subscription for the same query and variables. */
    () => expect(harness.observers).toHaveLength(2),
  );
  harness.observers[0].next?.({
    data: { account: { __typename: 'Account', id: 'A', label: 'Account A' } },
  });
  harness.observers[1].next?.({
    data: { account: { __typename: 'Account', id: 'B', label: 'Account B' } },
  });
  harness.observers[1].complete?.();
  expect((await current).data).toMatchObject({ account: { id: 'B' } });
  expect(JSON.stringify(client.cache.extract())).not.toContain('Account A');
  client.stop();
  harness.client.stop();
}

/** Neither late data nor late errors can reach the old query promise or normalized cache. */
async function testRetiredQuery(): Promise<void> {
  const shared = createSharedSessionEnvironment();
  const coordinator = new SessionCoordinator(shared.environment());
  const harness = transportHarness(coordinator);
  const result = harness.client.query({ fetchPolicy: 'network-only', query: accountQuery });
  const cancelled = expect(result).rejects.toBeInstanceOf(SessionOperationCancelledError);
  await vi.waitFor(
    /** Waits for actual dispatch, not an arbitrary elapsed transport delay. */
    () => expect(harness.observers).toHaveLength(1),
  );
  await coordinator.signOut(
    vi.fn().mockResolvedValue(undefined),
    /** Uses the same non-refetching cache retirement as the provider. */
    async () => {
      await harness.client.clearStore();
    },
  );
  await cancelled;
  expect(harness.signals[0].aborted).toBe(true);
  expect(harness.unsubscribed).toHaveBeenCalledTimes(1);
  harness.observers[0].next?.({
    data: { account: { __typename: 'Account', id: 'old', label: 'Account A secret' } },
  });
  harness.observers[0].error?.(new Error('Account A obsolete error'));
  expect(JSON.stringify(harness.client.cache.extract())).not.toContain('Account A');
  harness.client.stop();
}

/** Keeps old transport consumers addressable even after cancellation for late-delivery assertions. */
function transportHarness(coordinator: SessionCoordinator) {
  const observers: TransportObserver[] = [];
  const signals: AbortSignal[] = [];
  const unsubscribed = vi.fn();
  const network = new ApolloLink(
    /** Records the actual fence signal and leaves completion under scenario control. */
    (operation) =>
      new Observable<ApolloLink.Result>(
        /** A mocked transport can attempt late delivery after its real subscription was retired. */
        (observer) => {
          observers.push(observer);
          signals.push(operation.getContext().fetchOptions.signal as AbortSignal);
          return unsubscribed;
        },
      ),
  );
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createSessionFenceLink(coordinator).concat(network),
    queryDeduplication: false,
  });
  return { client, network, observers, signals, unsubscribed };
}

describe('Apollo session fence' /** Exercises pre-cache cancellation and delivery guards, not browser Set-Cookie semantics. */, () => {
  it('cancels old data and errors before cache delivery', testRetiredQuery);
  it('fences mutation completion even without a notification', testMissedNotificationMutation);
  it('does not deduplicate queries across auth epochs', testNoCrossEpochDeduplication);
  it('invalidates current session failures without cookie writes', testCurrentSessionFailures);
  it('retains cookie ordering through Apollo cache retirement', testCookieActionBarrier);
});
