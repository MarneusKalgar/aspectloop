import { createBrowserRouter, Navigate } from 'react-router-dom';

import { useAuth } from './auth/useAuth';
import { CorrectionsInboxPage } from './pages/CorrectionsInboxPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RootRedirectPage } from './pages/RootRedirectPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate replace to="/signin" />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user) {
    return <Navigate replace to="/corrections" />;
  }

  return <>{children}</>;
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
