import type { Role } from '../types/auth';

/**
 * Where each role lands after signing in. Today they share one adaptive
 * dashboard; to split them out later, point a role at its own route (e.g.
 * `doctor: '/doctor'`) and add that <Route> in App.tsx.
 */
export const HOME_FOR_ROLE: Record<Role, string> = {
  patient: '/dashboard',
  doctor: '/doctor',
  clinic_staff: '/doctor',
  admin: '/doctor',
};

/** Safe fallback used before the profile (and thus role) has loaded. */
export const DEFAULT_HOME = '/dashboard';

export function homeForRole(role: Role | null): string {
  return role ? HOME_FOR_ROLE[role] : DEFAULT_HOME;
}
