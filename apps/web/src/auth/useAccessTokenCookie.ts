import { useCallback } from 'react';
import { useCookies } from 'react-cookie';

import { accessTokenCookieName } from './access-token';

export interface AccessTokenCookieState {
  accessToken: null | string;
  clearAccessToken: () => void;
  setAccessToken: (accessToken: string) => void;
}

interface AccessTokenCookieValues {
  aspectloop_access_token?: string;
}

/**
 * Stores the browser access token in the AspectLoop-scoped authentication cookie.
 *
 * @returns The current access token and operations for setting or clearing it.
 */
export function useAccessTokenCookie(): AccessTokenCookieState {
  const [cookies, setCookie, removeCookie] = useCookies<
    'aspectloop_access_token',
    AccessTokenCookieValues
  >([accessTokenCookieName], { doNotParse: true });

  const accessToken = cookies[accessTokenCookieName] ?? null;

  const clearAccessToken = useCallback(() => {
    removeCookie(accessTokenCookieName, getAccessTokenCookieOptions());
  }, [removeCookie]);

  const setAccessToken = useCallback(
    (nextAccessToken: string) => {
      setCookie(accessTokenCookieName, nextAccessToken, getAccessTokenCookieOptions());
    },
    [setCookie],
  );

  return {
    accessToken,
    clearAccessToken,
    setAccessToken,
  };
}

function getAccessTokenCookieOptions() {
  return {
    path: '/',
    sameSite: 'lax' as const,
    ...(typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? { secure: true }
      : {}),
  };
}
