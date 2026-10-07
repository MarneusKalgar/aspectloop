import type { MeQuery, SignInInput, SignUpInput } from '@app/graphql/generated/graphql';

export const BROWSER_AUTH_STATUS = Object.freeze({
  ANONYMOUS: 'anonymous',
  AUTHENTICATED: 'authenticated',
  LOADING: 'loading',
  UNAVAILABLE: 'unavailable',
} as const);

export interface AuthActions {
  accountActionsAvailable: boolean;
  retryBootstrap: () => void;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
}

export type AuthContextValue = AuthActions & SessionState;

export type AuthenticatedUser = NonNullable<MeQuery['me']>;

export type BrowserAuthStatus = (typeof BROWSER_AUTH_STATUS)[keyof typeof BROWSER_AUTH_STATUS];

export type SessionState =
  | { status: typeof BROWSER_AUTH_STATUS.AUTHENTICATED; user: AuthenticatedUser }
  | {
      status:
        | typeof BROWSER_AUTH_STATUS.ANONYMOUS
        | typeof BROWSER_AUTH_STATUS.LOADING
        | typeof BROWSER_AUTH_STATUS.UNAVAILABLE;
      user: null;
    };
