import type { SessionCoordinator } from '@app/auth/session-coordination/session-coordinator';

import { ApolloLink, Observable } from '@apollo/client/core';
import { SessionOperationCancelledError } from '@app/auth/session-coordination/session-coordinator';
import { BROWSER_SESSION_ERROR_CODE, getSessionErrorCode } from '@app/auth/session-error';
import { OperationTypeNode } from 'graphql';

type FencedOperation = 'bootstrap' | 'product' | 'registration';
interface SessionLinkContext {
  fetchOptions?: RequestInit;
  sessionCookieAction?: boolean;
}

type SessionOperation = 'cookie-action' | FencedOperation;

/** Cancels obsolete results before Apollo writes cache or delivers them to hook consumers. */
export function createSessionFenceLink(coordinator: SessionCoordinator): ApolloLink {
  return new ApolloLink(
    /** Cookie executors settle uncached under their lock; ordinary work gets a revision fence. */
    (operation, forward) => {
      const context = operation.getContext() as SessionLinkContext;
      const kind = classifyOperation(operation, context);
      if (kind === 'cookie-action') {
        return forward(operation);
      }

      return createFencedObservable(coordinator, operation, forward, context, kind);
    },
  );
}

/** Uses the GraphQL operation enum to bypass only explicitly marked cookie mutations. */
function classifyOperation(
  operation: ApolloLink.Operation,
  context: SessionLinkContext,
): SessionOperation {
  if (
    context.sessionCookieAction === true &&
    operation.operationType === OperationTypeNode.MUTATION &&
    (operation.operationName === 'SignIn' || operation.operationName === 'SignOut')
  ) {
    return 'cookie-action';
  }

  if (operation.operationName === 'SignUp') {
    return 'registration';
  }

  if (operation.operationName === 'Me') {
    return 'bootstrap';
  }

  return 'product';
}

/** Stable session/dependency codes retire reads; ordinary product errors do not sign out users. */
function classifySessionFailure(
  coordinator: SessionCoordinator,
  revision: number,
  error: unknown,
): void {
  const code = getSessionErrorCode(error);
  if (code === BROWSER_SESSION_ERROR_CODE.SESSION_INVALID) {
    coordinator.fail('invalid', revision);
  } else if (code === BROWSER_SESSION_ERROR_CODE.DEPENDENCY_UNAVAILABLE) {
    coordinator.fail('unavailable', revision);
  }
}

/** Owns one subscription's generation, cancellation signal, listener, and downstream teardown. */
function createFencedObservable(
  coordinator: SessionCoordinator,
  operation: ApolloLink.Operation,
  forward: ApolloLink.ForwardFunction,
  context: SessionLinkContext,
  kind: FencedOperation,
): Observable<ApolloLink.Result> {
  return new Observable<ApolloLink.Result>(
    /** Captures resources together so completion, invalidation, and unmount share one cleanup. */
    (observer) => {
      coordinator.refresh();
      const revision = coordinator.getSnapshot().revision;
      const controller = new AbortController();
      const callerSignal = context.fetchOptions?.signal;
      operation.setContext({
        fetchOptions: {
          ...context.fetchOptions,
          signal: callerSignal
            ? AbortSignal.any([callerSignal, controller.signal])
            : controller.signal,
        },
      });
      /** Rechecks the captured generation instead of trusting React's last render. */
      const current = (): boolean => isCurrentOperation(coordinator, revision, kind);
      /** Settles consumers with a safe error while retiring HttpLink's transport. */
      const cancel = (): void => {
        controller.abort();
        observer.error(new SessionOperationCancelledError());
      };
      const dispose = coordinator.subscribe(
        /** Prevents peer actions from leaving old in-flight consumers alive. */
        () => {
          if (!current()) {
            cancel();
          }
        },
      );
      if (!current()) {
        cancel();
        dispose();
        return;
      }

      const downstream = forward(operation).subscribe({
        /** Completion cannot smuggle a retired operation back into Apollo. */
        complete() {
          if (current()) {
            observer.complete();
          } else {
            cancel();
          }
        },
        /** Sanitizes obsolete errors before classification or consumer delivery. */
        error(error: unknown) {
          if (!current()) {
            cancel();
            return;
          }

          classifySessionFailure(coordinator, revision, error);
          if (current() && kind !== 'registration' && !getSessionErrorCode(error)) {
            coordinator.fail('unavailable', revision);
          }

          if (current()) {
            observer.error(error);
          }
        },
        /** Classifies current session failures before any cache/UI delivery. */
        next(result) {
          if (!current()) {
            cancel();
            return;
          }

          if (result.errors) {
            for (const error of result.errors) {
              classifySessionFailure(coordinator, revision, error);
            }
          }

          if (current()) {
            observer.next(result);
          }
        },
      });
      /** Releases all owned resources on completion, cancellation, and unmount. */
      return () => {
        dispose();
        controller.abort();
        downstream.unsubscribe();
      };
    },
  );
}

/** Checks durable state at dispatch, peer notification, and every result/error delivery. */
function isCurrentOperation(
  coordinator: SessionCoordinator,
  revision: number,
  kind: FencedOperation,
): boolean {
  if (!coordinator.isCurrent(revision)) {
    return false;
  }
  if (kind === 'registration') {
    return coordinator.canRegister();
  }

  return coordinator.canRead() && (kind === 'bootstrap' || !coordinator.getSnapshot().failure);
}
