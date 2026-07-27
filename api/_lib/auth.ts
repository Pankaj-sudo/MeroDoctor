import type { VercelRequest } from '@vercel/node';
import { isDoctorEmail } from '../../src/config/doctor.js';
import type { Role } from '../../src/types/auth.js';
import { admin } from './firebaseAdmin.js';
import { unauthenticated } from './http.js';

// ============================================================================
// Request authentication.
//
// The ONLY trusted identity is the Firebase ID token in the Authorization
// header, verified against Google's public keys. Nothing in the request body
// (uid, role, email) is ever believed. The caller's role is then resolved
// server-side from the same two sources the Firestore rules use:
//   1. the registered-physician email allow-list (authoritative, token-verified)
//   2. the users/{uid}.role document
// ============================================================================

export interface AuthedUser {
  uid: string;
  email: string | null;
  name: string;
  role: Role;
  isDoctor: boolean;
}

function bearerToken(req: VercelRequest): string {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
    throw unauthenticated('Missing bearer token.');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw unauthenticated('Missing bearer token.');
  return token;
}

export async function authenticate(req: VercelRequest): Promise<AuthedUser> {
  const { auth, db } = admin();

  let decoded;
  try {
    // checkRevoked: a disabled or signed-out account must lose access at once,
    // not merely when its (up to 1 hour) token naturally expires.
    decoded = await auth.verifyIdToken(bearerToken(req), true);
  } catch {
    throw unauthenticated('Your session has expired. Sign in again.');
  }

  const email = decoded.email ?? null;
  const doctorByEmail = isDoctorEmail(email);

  // Fall back to the profile document for non-physician staff roles.
  let profileRole: Role | null = null;
  let profileName = '';
  try {
    const snap = await db.collection('users').doc(decoded.uid).get();
    if (snap.exists) {
      const data = snap.data() as { role?: Role; displayName?: string } | undefined;
      profileRole = data?.role ?? null;
      profileName = data?.displayName ?? '';
    }
  } catch (err) {
    console.error('[api] could not read user profile', err);
  }

  // A registered physician email always resolves to `doctor`, even if the
  // Firestore profile has not caught up yet — mirrors the client auth layer.
  const role: Role = doctorByEmail ? 'doctor' : (profileRole ?? 'patient');

  return {
    uid: decoded.uid,
    email,
    name: profileName || decoded.name || email || 'Participant',
    role,
    isDoctor: doctorByEmail || role === 'doctor',
  };
}

/** Doctors, admins and clinic staff — the roles allowed to manage a room. */
export function isStaff(user: AuthedUser): boolean {
  return user.isDoctor || user.role === 'admin' || user.role === 'clinic_staff';
}
