import { useAuth } from '@app/auth/useAuth';
import { Navigate } from 'react-router-dom';

export function RootRedirectPage() {
  const { user } = useAuth();

  return <Navigate replace to={user ? '/corrections' : '/signin'} />;
}
