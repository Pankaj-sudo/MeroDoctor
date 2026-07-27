import type { VercelRequest, VercelResponse } from '@vercel/node';

// Diagnostic probe. Dynamically loads every module the consultation endpoints
// pull in and reports which (if any) throws at load — turning an opaque
// FUNCTION_INVOCATION_FAILED into a precise, readable cause. Uses explicit .js
// specifiers to match native-ESM resolution on Vercel.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const out: Record<string, unknown> = {
    ok: true,
    node: process.version,
    env: {
      dailyKey: Boolean(process.env.DAILY_API_KEY),
      serviceAccountB64: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64),
      projectId: Boolean(process.env.FIREBASE_PROJECT_ID),
      clientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      privateKeyPem: (process.env.FIREBASE_PRIVATE_KEY || '').includes('BEGIN PRIVATE KEY'),
    },
  };

  const probe = async (name: string, load: () => Promise<unknown>) => {
    try {
      await load();
      out[name] = 'ok';
    } catch (e) {
      out[name] = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
  };

  await probe('src/config/doctor', () => import('../src/config/doctor.js'));
  await probe('src/config/video', () => import('../src/config/video.js'));
  await probe('src/lib/joinWindow', () => import('../src/lib/joinWindow.js'));
  await probe('_lib/http', () => import('./_lib/http.js'));
  await probe('_lib/firebaseAdmin', () => import('./_lib/firebaseAdmin.js'));
  await probe('_lib/providers', () => import('./_lib/providers/index.js'));
  await probe('_lib/auth', () => import('./_lib/auth.js'));
  await probe('_lib/consultations', () => import('./_lib/consultations.js'));

  // Non-secret structural fingerprint of the private key, to diagnose PEM
  // corruption without ever revealing key material. Only the public PEM header
  // (first ~27 chars) and boolean/length facts are exposed.
  const raw = process.env.FIREBASE_PRIVATE_KEY || '';
  const norm = raw
    .trim()
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .trim();
  out.keyShape = {
    rawLength: raw.length,
    startsWithQuote: raw.startsWith('"') || raw.startsWith("'"),
    header27: raw.slice(0, 27), // public PEM header, non-secret
    hasLiteralBackslashN: raw.includes('\\n'),
    hasRealNewline: raw.includes('\n'),
    normStartsWithBegin: norm.startsWith('-----BEGIN PRIVATE KEY-----'),
    normEndsWithEnd: norm.endsWith('-----END PRIVATE KEY-----'),
    normLineCount: norm.split('\n').length,
  };

  // Actually RUN the pieces the endpoints run, to surface the runtime cause
  // (the module loads fine, but admin() / Firestore may still throw).
  try {
    const { admin } = await import('./_lib/firebaseAdmin.js');
    const { db } = admin(); // initializeApp + cert(private key)
    out.adminInit = 'ok';
    const snap = await db.collection('consultations').limit(1).get();
    out.firestoreRead = `ok (${snap.size} docs)`;
  } catch (e) {
    out.runtimeError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  res.status(200).json(out);
}
