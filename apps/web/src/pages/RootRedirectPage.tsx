import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function RootRedirectPage() {
  const { user } = useAuth();

  return <Navigate replace to={user ? '/corrections' : '/signin'} />;
}
