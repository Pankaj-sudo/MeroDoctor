import type { VercelRequest, VercelResponse } from '@vercel/node';

// Diagnostic probe: ZERO runtime imports (the @vercel/node import is types-only,
// erased at build). If this 200s but the consultation endpoints 500 with
// FUNCTION_INVOCATION_FAILED, the Node runtime is fine and the crash is in a
// dependency (firebase-admin). If this ALSO fails, the function build/runtime
// config itself is the problem. Safe to leave in — it exposes no data.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    node: process.version,
    hasDailyKey: Boolean(process.env.DAILY_API_KEY),
    hasFirebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasFirebaseClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasFirebasePrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    privateKeyLooksPem:
      (process.env.FIREBASE_PRIVATE_KEY || '').includes('BEGIN PRIVATE KEY'),
  });
}
