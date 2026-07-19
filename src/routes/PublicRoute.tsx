import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homeForRole } from '../config/roles';
import { FullPageSpinner } from '../components/Spinner';

interface LocationState {
  from?: { pathname: string };
}

/**
 * Guards auth-only-when-signed-out pages (login/register). A signed-in user is
 * bounced to wherever they were headed, or their role home — so they can't sit
 * on the login screen while authenticated.
 */
export function PublicRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (isAuthenticated) {
    const from = (location.state as LocationState | null)?.from?.pathname;
    return <Navigate to={from ?? homeForRole(role)} replace />;
  }

  return <>{children}</>;
}
