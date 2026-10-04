import { BROWSER_AUTH_STATUS } from '@app/auth/session.types';
import { useAuth } from '@app/auth/useAuth';
import { Navigate } from 'react-router-dom';

/** Redirects only after a definitive browser-session state is known. */
export function RootRedirectPage() {
  const { status } = useAuth();

  if (status === BROWSER_AUTH_STATUS.AUTHENTICATED) {
    return <Navigate replace to="/corrections" />;
  }

  return status === BROWSER_AUTH_STATUS.ANONYMOUS ? <Navigate replace to="/signin" /> : null;
}
