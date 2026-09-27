import { createBrowserRouter, Navigate } from 'react-router-dom';

import { BROWSER_AUTH_STATUS } from './auth/session.types';
import { useAuth } from './auth/useAuth';
import { CorrectionsInboxPage } from './pages/CorrectionsInboxPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RootRedirectPage } from './pages/RootRedirectPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';

/** Allows protected pages only after the authoritative bootstrap succeeds. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === BROWSER_AUTH_STATUS.ANONYMOUS) {
    return <Navigate replace to="/signin" />;
  }

  return status === BROWSER_AUTH_STATUS.AUTHENTICATED ? <>{children}</> : null;
}

/** Keeps authenticated users out of anonymous-only account pages. */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === BROWSER_AUTH_STATUS.AUTHENTICATED) {
    return <Navigate replace to="/corrections" />;
  }

  return status === BROWSER_AUTH_STATUS.ANONYMOUS ? <>{children}</> : null;
}

export const router = createBrowserRouter([
  {
    element: <RootRedirectPage />,
    path: '/',
  },
  {
    element: (
      <PublicOnlyRoute>
        <SignInPage />
      </PublicOnlyRoute>
    ),
    path: '/signin',
  },
  {
    element: (
      <PublicOnlyRoute>
        <SignUpPage />
      </PublicOnlyRoute>
    ),
    path: '/signup',
  },
  {
    element: (
      <ProtectedRoute>
        <CorrectionsInboxPage />
      </ProtectedRoute>
    ),
    path: '/corrections',
  },
  {
    element: <NotFoundPage />,
    path: '*',
  },
]);
