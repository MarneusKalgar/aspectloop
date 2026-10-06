import { CombinedGraphQLErrors } from '@apollo/client/errors';

import type { SessionActionKind } from './session-marker';

import { isExpectedSignInRejection } from '../session-error';
import { AUTH_REQUEST_DEADLINE_MS, SESSION_ACTION_KIND } from './session-marker';

export interface CookieActionFailure {
  completed: boolean;
  expectedRejection: boolean;
}

/** Separates parsed server outcomes from transport uncertainty, without persisting errors. */
export function classifyCookieActionFailure(
  error: unknown,
  kind: SessionActionKind,
): CookieActionFailure {
  const expectedRejection =
    kind === SESSION_ACTION_KIND.SIGN_IN && isExpectedSignInRejection(error);

  return { completed: expectedRejection || CombinedGraphQLErrors.is(error), expectedRejection };
}

/** Bounds adapters even if they ignore cancellation; late completion cannot settle a marker. */
export async function requestCookieAction<T>(
  execute: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>(
    /** Timeout is uncertainty, not an acknowledgement or remote rollback. */
    (_resolve, reject) => {
      timer = setTimeout(
        /** Cancels transport before rejecting the bounded account-action promise. */
        () => {
          controller.abort();
          reject(new Error('Account action timed out. Reset the browser session.'));
        },
        AUTH_REQUEST_DEADLINE_MS,
      );
    },
  );

  try {
    return await Promise.race([execute(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
