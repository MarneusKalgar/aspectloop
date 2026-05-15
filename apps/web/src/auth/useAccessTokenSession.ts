import { type AuthenticatedUser, readUserFromAccessToken } from './access-token';
import { useAccessTokenCookie } from './useAccessTokenCookie';

export interface AccessTokenSession {
  accessToken: null | string;
  clearAccessToken: () => void;
  setAccessToken: (accessToken: string) => void;
  user: AuthenticatedUser | null;
}

export function useAccessTokenSession(): AccessTokenSession {
  const { accessToken, clearAccessToken, setAccessToken } = useAccessTokenCookie();

  return {
    accessToken,
    clearAccessToken,
    setAccessToken,
    user: accessToken ? readUserFromAccessToken(accessToken) : null,
  };
}
