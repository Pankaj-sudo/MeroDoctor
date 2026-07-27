import type { VercelRequest, VercelResponse } from '@vercel/node';

// Diagnostic probe. Dynamically loads every module the consultation endpoints
// pull in (firebase-admin, the shared src/* code, and each api/_lib module) and
// reports which one throws at load — turning the opaque FUNCTION_INVOCATION_FAILED
// into a precise, readable cause.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const out: Record<string, unknown> = {
    ok: true,
    node: process.version,
    env: {
      dailyKey: Boolean(process.env.DAILY_API_KEY),
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

  // Shared code from src/* (must be safe for a Node/server bundle).
  await probe('src/config/doctor', () => import('../src/config/doctor'));
  await probe('src/config/video', () => import('../src/config/video'));
  await probe('src/lib/joinWindow', () => import('../src/lib/joinWindow'));
  // The api/_lib chain.
  await probe('_lib/http', () => import('./_lib/http'));
  await probe('_lib/firebaseAdmin', () => import('./_lib/firebaseAdmin'));
  await probe('_lib/providers', () => import('./_lib/providers'));
  await probe('_lib/auth', () => import('./_lib/auth'));
  await probe('_lib/consultations', () => import('./_lib/consultations'));

  res.status(200).json(out);
}
