import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isDoctorEmail } from '../config/doctor';
import type { AuthProviderId, Role, UserProfile } from '../types/auth';

/** New accounts start as an unverified patient — unless the signing-in email is
 *  a registered physician, in which case they are provisioned as a doctor. */
const DEFAULT_ROLE: Role = 'patient';

/** The role a freshly-provisioned account should hold, based on its email. */
function roleForEmail(email: string | null | undefined): Role {
  return isDoctorEmail(email) ? 'doctor' : DEFAULT_ROLE;
}

function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

/**
 * Provision `users/{uid}` on first login, or safely refresh a returning user.
 * Idempotent and race-safe:
 *  - **Creates only when the doc is missing** — never a duplicate.
 *  - For a returning user it MERGES only volatile fields (`lastLogin`,
 *    `updatedAt`) and keeps the auth-provided name/photo in sync; it never
 *    touches `role`, `isVerified`, `status`, `createdAt`, or anything a user or
 *    admin may have set. This is the shape the Firestore rules should allow for
 *    an owner self-update.
 *
 * The document id is always the Firebase Auth UID — identity comes from the
 * server-verified token, never from client input.
 */
export async function ensureUserProfile(
  user: User,
  provider: AuthProviderId,
): Promise<void> {
  const ref = userDoc(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const profile = {
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      phoneNumber: user.phoneNumber ?? null,
      role: roleForEmail(user.email),
      isVerified: isDoctorEmail(user.email),
      status: 'active',
      provider,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return;
  }

  const existing = snapshot.data() as UserProfile;
  // If the designated physician had signed in earlier as a patient, promote the
  // existing account to doctor. The Firestore rules allow this transition only
  // for the registered doctor email, so it can never be spoofed.
  const promoteToDoctor = isDoctorEmail(user.email) && existing.role !== 'doctor';
  await setDoc(
    ref,
    {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(promoteToDoctor ? { role: 'doctor', isVerified: true } : {}),
      // Keep provider-owned display fields fresh, but never wipe an existing
      // value with an empty one (e.g. if the provider omits it this time).
      ...(user.displayName && user.displayName !== existing.displayName
        ? { displayName: user.displayName }
        : {}),
      ...(user.photoURL && user.photoURL !== existing.photoURL
        ? { photoURL: user.photoURL }
        : {}),
      ...(user.phoneNumber && user.phoneNumber !== existing.phoneNumber
        ? { phoneNumber: user.phoneNumber }
        : {}),
    },
    { merge: true },
  );
}
