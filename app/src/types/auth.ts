import type { Timestamp } from 'firebase/firestore';

/** Roles a user can hold. Self-signup only ever assigns `patient`; the others
 *  are granted out-of-band (doctor onboarding / admin promotion). */
export type Role = 'patient' | 'doctor' | 'clinic_staff' | 'admin';

export type UserStatus = 'active' | 'disabled';

/** Which sign-in method created the account. Extend as providers are added. */
export type AuthProviderId = 'google' | 'password' | 'apple' | 'facebook' | 'github';

/**
 * The Firestore `users/{uid}` document. `uid` is always the Firebase Auth UID —
 * it is the single source of truth for identity; never trust client-passed ids.
 * Server-set timestamps are `null` for the instant between a local write and the
 * server resolving `serverTimestamp()`.
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  phoneNumber: string | null;
  role: Role;
  isVerified: boolean;
  status: UserStatus;
  provider: AuthProviderId;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastLogin: Timestamp | null;
}
