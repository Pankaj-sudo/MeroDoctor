import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homeForRole } from '../config/roles';
import { FullPageSpinner } from '../components/Spinner';
import type { Role } from '../types/auth';

/**
 * Guards authenticated pages.
 *  - Still resolving auth → full-page spinner (no flicker/redirect races).
 *  - Not signed in → /login, remembering where they were headed.
 *  - Signed in but role not allowed → their own role home.
 */
export function ProtectedRoute({
  children,
  allow,
}: {
  children: ReactNode;
  allow?: Role[];
}) {
  const { loading, isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Loading your account…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow && role && !allow.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return <>{children}</>;
}
