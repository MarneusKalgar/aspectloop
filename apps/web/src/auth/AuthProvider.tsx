import type { SignInInput, SignUpInput } from '@app/graphql/generated/graphql';

import { useApolloClient } from '@apollo/client/react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  useMeQuery,
  useSignInMutation,
  useSignOutMutation,
  useSignUpMutation,
} from '../graphql/hooks/auth';
import { isExpectedSignInRejection, isInvalidSessionError } from './session-error';
import { type AuthContextValue, BROWSER_AUTH_STATUS, type SessionState } from './session.types';

export type { AuthContextValue } from './session.types';

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_REQUEST_DEADLINE_MS = 10_000;

/** Coordinates one tab's in-memory identity with authoritative browser-session requests. */
export function AuthProvider({ children }: PropsWithChildren) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const loadMe = useMeQuery();
  const signInMutation = useSignInMutation();
  const signOutMutation = useSignOutMutation();
  const signUpMutation = useSignUpMutation();
  const [session, setSession] = useState<SessionState>({
    status: BROWSER_AUTH_STATUS.LOADING,
    user: null,
  });
  const generation = useRef(0);
  const actionInProgress = useRef(false);
  const logoutUnconfirmed = useRef(false);

  /** Resolves only a current bootstrap result into one of the four UI states. */
  const bootstrap = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const selectedGeneration = ++generation.current;
      setSession({ status: BROWSER_AUTH_STATUS.LOADING, user: null });

      try {
        const user = await loadMe(signal);

        if (!signal.aborted && selectedGeneration === generation.current) {
          setSession(
            user
              ? { status: BROWSER_AUTH_STATUS.AUTHENTICATED, user }
              : { status: BROWSER_AUTH_STATUS.UNAVAILABLE, user: null },
          );
        }
      } catch (error) {
        if (selectedGeneration === generation.current) {
          setSession({
            status: isInvalidSessionError(error)
              ? BROWSER_AUTH_STATUS.ANONYMOUS
              : BROWSER_AUTH_STATUS.UNAVAILABLE,
            user: null,
          });
        }
      }
    },
    [loadMe],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void bootstrap(
          AbortSignal.any([controller.signal, AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS)]),
        );
      }
    });

    return () => {
      generation.current += 1;
      controller.abort();
    };
  }, [bootstrap]);

  /** Rechecks the cookie explicitly after an ordinary dependency failure. */
  function retryBootstrap(): void {
    if (!logoutUnconfirmed.current && !actionInProgress.current) {
      void bootstrap(AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS));
    }
  }

  /** Publishes a new identity only after the cookie is set and old cache is gone. */
  async function signIn(input: SignInInput): Promise<void> {
    if (
      actionInProgress.current ||
      logoutUnconfirmed.current ||
      session.status !== BROWSER_AUTH_STATUS.ANONYMOUS
    ) {
      throw new Error('Authentication action is unavailable');
    }

    actionInProgress.current = true;
    generation.current += 1;
    const signal = AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS);

    try {
      const result = await signInMutation.execute(input, signal);

      if (signal.aborted || !result?.user) {
        throw new Error('Sign-in result is unavailable');
      }

      await client.clearStore();
      if (signal.aborted) {
        throw new Error('Sign-in result exceeded the request deadline');
      }
      setSession({ status: BROWSER_AUTH_STATUS.AUTHENTICATED, user: result.user });
    } catch (error) {
      if (!isExpectedSignInRejection(error)) {
        setSession({ status: BROWSER_AUTH_STATUS.UNAVAILABLE, user: null });
      }

      throw error;
    } finally {
      actionInProgress.current = false;
    }
  }

  /** Drops local access immediately and reports any unconfirmed revocation. */
  async function signOut(): Promise<void> {
    if (actionInProgress.current || logoutUnconfirmed.current) {
      throw new Error('Authentication action is unavailable');
    }

    actionInProgress.current = true;
    generation.current += 1;
    const signal = AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS);
    setSession({ status: BROWSER_AUTH_STATUS.LOADING, user: null });

    try {
      await client.clearStore();
      const result = await signOutMutation.execute(signal);

      if (signal.aborted || result?.success !== true) {
        throw new Error('Sign-out revocation was not confirmed');
      }

      setSession({ status: BROWSER_AUTH_STATUS.ANONYMOUS, user: null });
    } catch (error) {
      logoutUnconfirmed.current = true;
      setSession({ status: BROWSER_AUTH_STATUS.UNAVAILABLE, user: null });
      throw error;
    } finally {
      actionInProgress.current = false;
    }
  }

  /** Keeps the existing signup contract until confirmation HTTP activation. */
  async function signUp(input: SignUpInput): Promise<void> {
    if (
      actionInProgress.current ||
      logoutUnconfirmed.current ||
      session.status !== BROWSER_AUTH_STATUS.ANONYMOUS
    ) {
      throw new Error('Authentication action is unavailable');
    }

    actionInProgress.current = true;
    const signal = AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS);

    try {
      const result = await signUpMutation.execute(input, signal);

      if (signal.aborted || !result?.success) {
        throw new Error('Sign-up result is unavailable');
      }
    } finally {
      actionInProgress.current = false;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        retryBootstrap,
        signIn,
        signOut,
        signUp,
        ...session,
      }}
    >
      {session.status === BROWSER_AUTH_STATUS.LOADING ? (
        <Box
          aria-label={t('router.loading')}
          role="status"
          sx={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}
        >
          <CircularProgress />
        </Box>
      ) : null}
      {session.status === BROWSER_AUTH_STATUS.UNAVAILABLE ? (
        <Box sx={{ maxWidth: 560, mx: 'auto', p: 4 }}>
          <Alert
            action={
              logoutUnconfirmed.current ? undefined : (
                <Button color="inherit" onClick={retryBootstrap} size="small">
                  {t('auth.session.retry')}
                </Button>
              )
            }
            severity="warning"
          >
            {t(
              logoutUnconfirmed.current
                ? 'auth.session.logoutUnconfirmed'
                : 'auth.session.unavailable',
            )}
          </Alert>
        </Box>
      ) : null}
      {session.status === BROWSER_AUTH_STATUS.ANONYMOUS ||
      session.status === BROWSER_AUTH_STATUS.AUTHENTICATED
        ? children
        : null}
    </AuthContext.Provider>
  );
}

/** Provides the current user and explicit session actions to routed screens. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
