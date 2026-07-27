import type { VercelRequest, VercelResponse } from '@vercel/node';

// Diagnostic probe. Dynamically loads each firebase-admin entry point and
// reports per-module success/failure, converting the opaque
// FUNCTION_INVOCATION_FAILED (a module-load crash) into a readable error.
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

  await probe('firebase-admin/app', () => import('firebase-admin/app'));
  await probe('firebase-admin/auth', () => import('firebase-admin/auth'));
  await probe('firebase-admin/firestore', () => import('firebase-admin/firestore'));

  res.status(200).json(out);
}
