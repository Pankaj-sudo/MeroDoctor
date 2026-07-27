import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpError } from './http.js';

// ============================================================================
// Firebase Admin singleton.
//
// Serverless instances are reused between invocations, so the app is
// initialised at most once per warm container. The service-account credentials
// are SERVER-ONLY env vars (no VITE_ prefix) and therefore never reach the
// browser bundle.
// ============================================================================

let cached: { app: App; auth: Auth; db: Firestore } | null = null;

/**
 * Read a required server env var.
 *
 * Throws an HttpError (not a bare Error) so the message reaches the caller
 * verbatim instead of collapsing into the generic 500 funnel. A missing
 * variable is an operator mistake, and "FIREBASE_PROJECT_ID is not configured"
 * is the difference between a five-second fix and an afternoon of guessing.
 * Only the variable NAME is disclosed — never a value.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(
      500,
      'server_error',
      `${name} is not configured on the server. Add the Firebase service-account ` +
        'env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) ' +
        'to .env.local for local dev, or to the Vercel project settings, then restart/redeploy.',
    );
  }
  return value;
}

/**
 * Normalise a PEM private key pasted into an env var, tolerating the common
 * corruptions so `cert()` doesn't fail with an opaque OpenSSL DECODER error:
 *  - surrounding single/double quotes (Vercel's UI keeps them literally, unlike
 *    a .env file where the loader strips them),
 *  - escaped newlines (`\n` or `\r\n`) instead of real ones,
 *  - Windows CRLF line endings.
 * The result is a valid multi-line PEM regardless of how it was entered.
 */
function normalizePrivateKey(raw: string): string {
  return raw
    .trim()
    .replace(/\\r\\n/g, '\n') // escaped CRLF → LF
    .replace(/\\n/g, '\n') // escaped LF → real LF
    .replace(/\r\n/g, '\n') // real CRLF → LF
    .trim()
    // Strip stray wrapping quotes INDEPENDENTLY at each end: a paste can leave a
    // leading " with no trailing one (or vice-versa), which the earlier
    // "both-or-nothing" check missed, corrupting the PEM (DECODER unsupported).
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .trim();
}

export function admin(): { app: App; auth: Auth; db: Firestore } {
  if (cached) return cached;

  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = normalizePrivateKey(requireEnv('FIREBASE_PRIVATE_KEY'));

  const app =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
