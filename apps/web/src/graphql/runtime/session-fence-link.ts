import type { SessionCoordinator } from '@app/auth/session-coordination/session-coordinator';

import { ApolloLink, Observable } from '@apollo/client/core';
import { SessionOperationCancelledError } from '@app/auth/session-coordination/session-coordinator';
import { BROWSER_SESSION_ERROR_CODE, getSessionErrorCode } from '@app/auth/session-error';
import { OperationTypeNode } from 'graphql';

import { GRAPHQL_OPERATION_NAME } from '../operation-names';

const SESSION_OPERATION = Object.freeze({
  BOOTSTRAP: 'bootstrap',
  COOKIE_ACTION: 'cookie-action',
  PRODUCT: 'product',
  PUBLIC_REGISTRATION: 'public-registration',
  REGISTRATION: 'registration',
} as const);

type FencedOperation = Exclude<
  SessionOperation,
  typeof SESSION_OPERATION.COOKIE_ACTION | typeof SESSION_OPERATION.PUBLIC_REGISTRATION
>;
interface SessionLinkContext {
  fetchOptions?: RequestInit;
  sessionCookieAction?: boolean;
}

type SessionOperation = (typeof SESSION_OPERATION)[keyof typeof SESSION_OPERATION];

/** Cancels obsolete results before Apollo writes cache or delivers them to hook consumers. */
export function createSessionFenceLink(coordinator: SessionCoordinator): ApolloLink {
  return new ApolloLink(
    /** Cookie executors keep their lock; public registration stays uncached and identity-neutral. */
    (operation, forward) => {
      const context = operation.getContext() as SessionLinkContext;
      const kind = classifyOperation(operation, context);

      if (
        kind === SESSION_OPERATION.COOKIE_ACTION ||
        kind === SESSION_OPERATION.PUBLIC_REGISTRATION
      ) {
        return forward(operation);
      }

      return createFencedObservable(coordinator, operation, forward, context, kind);
    },
  );
}

/** Separates fixed public confirmation commands from explicitly marked cookie mutations. */
function classifyOperation(
  operation: ApolloLink.Operation,
  context: SessionLinkContext,
): SessionOperation {
  if (
    operation.operationType === OperationTypeNode.MUTATION &&
    (operation.operationName === GRAPHQL_OPERATION_NAME.CONFIRM_EMAIL ||
      operation.operationName === GRAPHQL_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION)
  ) {
    // Public, uncached operations neither consume nor publish a browser session generation.
    return SESSION_OPERATION.PUBLIC_REGISTRATION;
  }

  if (
    context.sessionCookieAction === true &&
    operation.operationType === OperationTypeNode.MUTATION &&
    (operation.operationName === GRAPHQL_OPERATION_NAME.SIGN_IN ||
      operation.operationName === GRAPHQL_OPERATION_NAME.SIGN_OUT)
  ) {
    return SESSION_OPERATION.COOKIE_ACTION;
  }

  if (operation.operationName === GRAPHQL_OPERATION_NAME.SIGN_UP) {
    return SESSION_OPERATION.REGISTRATION;
  }

  if (operation.operationName === GRAPHQL_OPERATION_NAME.ME) {
    return SESSION_OPERATION.BOOTSTRAP;
  }

  return SESSION_OPERATION.PRODUCT;
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
        /** Fences obsolete errors; only uncoded bootstrap errors retire an otherwise current session. */
        error(error: unknown) {
          if (!current()) {
            cancel();
            return;
          }

          classifySessionFailure(coordinator, revision, error);

          if (current() && kind === SESSION_OPERATION.BOOTSTRAP && !getSessionErrorCode(error)) {
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
  if (kind === SESSION_OPERATION.REGISTRATION) {
    return coordinator.canRegister();
  }

  return (
    coordinator.canRead() &&
    (kind === SESSION_OPERATION.BOOTSTRAP || !coordinator.getSnapshot().failure)
  );
}
