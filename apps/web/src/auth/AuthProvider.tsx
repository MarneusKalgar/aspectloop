import { useApolloClient } from '@apollo/client/react';
import { createContext, type PropsWithChildren, useContext, useEffect } from 'react';

import { useSignInMutation, useSignOutMutation, useSignUpMutation } from '../graphql/hooks/auth';
import { type AuthenticatedUser, readUserFromAccessToken } from './access-token';
import { useAccessTokenSession } from './useAccessTokenSession';

export interface AuthContextValue {
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: { displayName: string; email: string; password: string }) => Promise<void>;
  user: AuthenticatedUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useApolloClient();
  const signInMutation = useSignInMutation();
  const signOutMutation = useSignOutMutation();
  const signUpMutation = useSignUpMutation();
  const { accessToken, clearAccessToken, setAccessToken, user } = useAccessTokenSession();

  useEffect(() => {
    if (accessToken && !user) {
      clearAccessToken();
    }
  }, [accessToken, clearAccessToken, user]);

  async function signIn(input: { email: string; password: string }) {
    const signInResult = await signInMutation.execute(input);
    const nextAccessToken = signInResult?.accessToken;

    if (!nextAccessToken) {
      throw new Error();
    }

    if (!readUserFromAccessToken(nextAccessToken)) {
      throw new Error();
    }

    setAccessToken(nextAccessToken);
  }

  async function signOut() {
    try {
      if (accessToken) {
        await signOutMutation.execute();
      }
    } finally {
      clearAccessToken();
      await client.clearStore();
    }
  }

  async function signUp(input: { displayName: string; email: string; password: string }) {
    const signUpResult = await signUpMutation.execute(input);

    if (!signUpResult?.success) {
      throw new Error();
    }
  }

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        signUp,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
