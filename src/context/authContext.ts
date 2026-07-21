import { createContext } from 'react';
import type { User } from 'firebase/auth';
import type { Role, UserProfile } from '../types/auth';

/**
 * The global authentication state every component can read via `useAuth()`.
 * `user` is the Firebase Auth user (identity); `profile` is the Firestore
 * `users/{uid}` document (role, verification, etc.).
 */
export interface AuthContextValue {
  /** Firebase Auth user, or null when signed out. */
  user: User | null;
  /** Firestore profile document, or null while loading / not yet provisioned. */
  profile: UserProfile | null;
  /** True until the initial auth + profile state has resolved. Gate UI on this. */
  loading: boolean;
  /** Convenience: a signed-in user exists. */
  isAuthenticated: boolean;
  /** The user's effective role, or null. Registered physician emails always
   *  resolve to `doctor` even before the Firestore profile catches up. */
  role: Role | null;
  /** Elevated administrator privileges (registered doctor email, `admin` role,
   *  or an `isAdmin` profile flag). */
  isAdmin: boolean;
  /** Whether the account is verified (e.g. a verified doctor). */
  isVerified: boolean;
  /** Start Google sign-in (call from a click). Throws on real errors. */
  signInWithGoogle: () => Promise<void>;
  /** Sign the current user out. */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
