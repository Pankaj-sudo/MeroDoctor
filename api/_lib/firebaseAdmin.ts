import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// ============================================================================
// Firebase Admin singleton.
//
// Serverless instances are reused between invocations, so the app is
// initialised at most once per warm container. The service-account credentials
// are SERVER-ONLY env vars (no VITE_ prefix) and therefore never reach the
// browser bundle.
// ============================================================================

let cached: { app: App; auth: Auth; db: Firestore } | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not configured on the server. Add the Firebase service-account ` +
        'env vars in the Vercel project settings and redeploy.',
    );
  }
  return value;
}

export function admin(): { app: App; auth: Auth; db: Firestore } {
  if (cached) return cached;

  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  // Vercel stores newlines escaped; restore them or the PEM parse fails.
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const app =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
