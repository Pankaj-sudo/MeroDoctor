import { signInWithPopup, signOut, type UserCredential } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { ensureUserProfile } from './userService';

/**
 * Sign in with Google via a popup, then provision/refresh the Firestore profile.
 * Must be called from a user gesture (a click) or the browser will block the
 * popup. Resolves with the Firebase `UserCredential`; the global auth state
 * (AuthProvider) updates itself via `onAuthStateChanged`.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const credential = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(credential.user, 'google');
  return credential;
}

/** Sign the current user out. Auth state clears via `onAuthStateChanged`. */
export function logout(): Promise<void> {
  return signOut(auth);
}

/**
 * Turn a Firebase auth error into a short, human-readable message.
 * Returns '' when the user simply dismissed the popup — not worth showing.
 * Technical detail stays in the console; this is only what the UI displays.
 */
export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return '';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in isn’t enabled for this project yet. Enable it in Firebase Console → Authentication → Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This domain isn’t authorised for sign-in. Add it in Firebase Console → Authentication → Settings → Authorised domains.';
    case 'auth/network-request-failed':
      return 'Network unavailable. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/internal-error':
      return 'An internal authentication error occurred. Please try again.';
    default:
      return `Sign-in failed${code ? ` (${code})` : ''}. Please try again.`;
  }
}
