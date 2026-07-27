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

interface ServiceAccountFields {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Resolve the service-account credentials. Prefers a single base64-encoded
 * service-account JSON (FIREBASE_SERVICE_ACCOUNT_B64) — one clean line that
 * cannot be corrupted by quote/newline paste artifacts — and falls back to the
 * three individual FIREBASE_* vars (with tolerant private-key parsing).
 */
function resolveServiceAccount(): ServiceAccountFields {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    let json: { project_id?: string; client_email?: string; private_key?: string };
    try {
      json = JSON.parse(Buffer.from(b64.trim(), 'base64').toString('utf8'));
    } catch (err) {
      throw new HttpError(
        500,
        'server_error',
        'FIREBASE_SERVICE_ACCOUNT_B64 is set but is not valid base64-encoded JSON. ' +
          `Re-encode the service-account file: base64 -i serviceAccount.json (${String(err)}).`,
      );
    }
    if (!json.project_id || !json.client_email || !json.private_key) {
      throw new HttpError(
        500,
        'server_error',
        'FIREBASE_SERVICE_ACCOUNT_B64 decoded but is missing project_id / client_email / private_key.',
      );
    }
    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: normalizePrivateKey(json.private_key),
    };
  }

  return {
    projectId: requireEnv('FIREBASE_PROJECT_ID'),
    clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: normalizePrivateKey(requireEnv('FIREBASE_PRIVATE_KEY')),
  };
}

export function admin(): { app: App; auth: Auth; db: Firestore } {
  if (cached) return cached;

  const { projectId, clientEmail, privateKey } = resolveServiceAccount();

  const app =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
