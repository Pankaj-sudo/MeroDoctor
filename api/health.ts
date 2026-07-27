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

  res.status(200).json(out);
}
