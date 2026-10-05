import type { SignInInput, SignUpInput } from '@app/graphql/generated/graphql';

import { useApolloClient } from '@apollo/client/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSignInMutation, useSignOutMutation, useSignUpMutation } from '../graphql/hooks/auth';
import {
  type SessionCoordinator,
  SessionOperationCancelledError,
  SessionSignInRejectedError,
} from './session-coordination/session-coordinator';
import { AUTH_REQUEST_DEADLINE_MS } from './session-coordination/session-marker';
import { getSessionErrorCode, isExpectedSignInRejection } from './session-error';
import { getSignInRejectionMessageKey, type SessionView } from './session-view';
import { BROWSER_AUTH_STATUS } from './session.types';

export interface SignInRejection {
  epoch: string;
  message: string;
}

/** Owns imperative account actions and transient feedback, never authoritative identity. */
export function useSessionActions(
  coordinator: SessionCoordinator,
  revision: number,
  view: SessionView,
) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const executeSignIn = useSignInMutation();
  const executeSignOut = useSignOutMutation();
  const signUpMutation = useSignUpMutation();
  const actionInProgress = useRef(false);
  const logoutRunning = useRef(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [rejection, setRejection] = useState<null | SignInRejection>(null);

  /** Starts only a still-current anonymous login; subsequent Me publishes its identity. */
  async function signIn(input: SignInInput): Promise<void> {
    if (
      actionInProgress.current ||
      !view.accountActionsAvailable ||
      view.session.status !== BROWSER_AUTH_STATUS.ANONYMOUS
    ) {
      throw new Error('Authentication action is unavailable');
    }

    actionInProgress.current = true;
    setRejection(null);

    try {
      await client.clearStore();

      if (!coordinator.isCurrent(revision)) {
        throw new SessionOperationCancelledError();
      }

      await coordinator.signIn(
        /** Keeps cookie settlement under the lock and identity uncached. */
        async (signal) => {
          const result = await executeSignIn(input, signal);

          if (!result?.user) {
            throw new Error('Sign-in result is unavailable');
          }
        },
      );

      coordinator.refresh();

      if (!coordinator.canRead() || coordinator.getSnapshot().failure) {
        throw new SessionOperationCancelledError();
      }
    } catch (error) {
      const current = coordinator.getSnapshot().marker;
      if (
        error instanceof SessionSignInRejectedError &&
        isExpectedSignInRejection(error) &&
        current?.epoch === error.epoch &&
        !current.logoutIntent &&
        !current.action
      ) {
        setRejection({
          epoch: current.epoch,
          message: t(getSignInRejectionMessageKey(getSessionErrorCode(error))),
        });
      }
      throw error;
    } finally {
      actionInProgress.current = false;
    }
  }

  /** Lets local logout supersede login without cancelling its cookie ordering barrier. */
  async function signOut(): Promise<void> {
    if (logoutRunning.current) {
      throw new Error('Sign-out is already in progress');
    }
    logoutRunning.current = true;
    setLogoutBusy(true);

    try {
      await coordinator.signOut(
        /** Requires explicit server acknowledgement, not just a settled HTTP request. */
        async (signal) => {
          const result = await executeSignOut(signal);
          if (result?.success !== true) {
            throw new Error('Sign-out revocation was not confirmed');
          }
        },
        /** Retires product cache without refetching protected queries. */
        async () => {
          await client.clearStore();
        },
      );
    } finally {
      logoutRunning.current = false;
      setLogoutBusy(false);
    }
  }

  /** Preserves registration semantics while fencing a retired completion. */
  async function signUp(input: SignUpInput): Promise<void> {
    if (
      actionInProgress.current ||
      !coordinator.canRegister() ||
      view.session.status !== BROWSER_AUTH_STATUS.ANONYMOUS
    ) {
      throw new Error('Authentication action is unavailable');
    }

    actionInProgress.current = true;

    try {
      const result = await signUpMutation.execute(
        input,
        AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS),
      );

      if (!coordinator.isCurrent(revision)) {
        throw new SessionOperationCancelledError();
      }

      if (!result?.success) {
        throw new Error('Sign-up result is unavailable');
      }
    } finally {
      actionInProgress.current = false;
    }
  }

  return { logoutBusy, rejection, signIn, signOut, signUp };
}
