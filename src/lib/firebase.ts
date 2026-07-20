import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** False when the env config hasn't been filled in — screens can gate on this. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isFirebaseConfigured) {
  console.error(
    '[firebase] Missing VITE_FIREBASE_* env vars. On Vercel: Settings → Environment ' +
      'Variables → add all six, then redeploy. Showing the setup notice instead of the app.',
  );
}

// When the config is missing (e.g. env vars not set on the host), initialise with
// a harmless placeholder so top-level getAuth/getFirestore don't throw
// `auth/invalid-api-key` and blank the screen. The UI gates on
// isFirebaseConfigured and shows a "Setup needed" notice instead of a blank page.
export const app = initializeApp(
  isFirebaseConfigured
    ? firebaseConfig
    : { apiKey: 'unconfigured-placeholder', projectId: 'unconfigured', appId: 'unconfigured' },
);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * One shared Google provider. `select_account` always shows the account chooser
 * (so users can pick/switch instead of being silently signed into a stale one).
 * We only ever request the default profile + email scopes we store.
 */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Keep the session in local storage so the user stays signed in across page
 * refreshes, browser restarts, and return visits. This is Firebase's default,
 * but we set it explicitly so it can never silently regress. Fire-and-forget:
 * it resolves before the first sign-in completes.
 */
if (isFirebaseConfigured) {
  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('[firebase] Failed to set auth persistence', error);
  });
}
