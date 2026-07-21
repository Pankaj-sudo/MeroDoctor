import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { signInWithGoogle as authSignInWithGoogle, logout as authLogout } from '../services/authService';
import { isDoctorEmail } from '../config/doctor';
import type { Role, UserProfile } from '../types/auth';
import { AuthContext, type AuthContextValue } from './authContext';

/**
 * Owns the single source of truth for auth state and shares it with the whole
 * app. It keeps exactly two live subscriptions:
 *   1. `onAuthStateChanged` — identity (fires on login/logout + restores the
 *      persisted session on load).
 *   2. `onSnapshot(users/{uid})` — the profile, so role/verification changes
 *      reflect live without extra reads.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  // 1) Identity. Also restores a persisted session on first load.
  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  // 2) Profile — live, scoped to the signed-in user.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(
      ref,
      (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
        setProfileReady(true);
      },
      (error) => {
        console.error('[auth] profile subscription error', error);
        setProfileReady(true); // never hang the UI on a read failure
      },
    );
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    await authSignInWithGoogle();
    // State updates arrive via the subscriptions above.
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    // A registered physician email is authoritative for the client's role and
    // admin flag: it comes from the Firebase-verified token, so we recognise the
    // doctor/admin instantly — even if the Firestore profile is still a stale
    // 'patient' (e.g. the promotion write is pending, or the rules that permit it
    // have not been published yet). Server-side data access is still governed by
    // the Firestore rules, which enforce the same email allow-list.
    const emailIsDoctor = isDoctorEmail(user?.email ?? null);
    const role: Role | null = emailIsDoctor ? 'doctor' : (profile?.role ?? null);
    const isAdmin = emailIsDoctor || profile?.role === 'admin' || profile?.isAdmin === true;
    return {
      user,
      profile,
      loading: !authReady || !profileReady,
      isAuthenticated: Boolean(user),
      role,
      isAdmin,
      isVerified: emailIsDoctor || (profile?.isVerified ?? false),
      signInWithGoogle,
      logout,
    };
  }, [user, profile, authReady, profileReady, signInWithGoogle, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
