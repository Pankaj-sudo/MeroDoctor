import { CONSULTATION_FEE, formatNpr } from './payment';

// ============================================================================
// MeroDoctor — the practice's physician(s). Single source of truth for who the
// doctor is, both for the public "Your Dedicated Physician" section and for the
// auth layer that grants the Doctor Dashboard.
//
// Today the practice runs as a concierge single-physician model. To add doctors
// later, extend PHYSICIANS and DOCTOR_EMAILS — nothing else needs to change in
// the auth/role logic (it already checks membership, not a single value).
// ============================================================================

export interface Physician {
  /** Stable id (used for booking/assignment when multiple doctors exist). */
  id: string;
  name: string;
  /** Fallback monogram when there is no portrait. */
  initials: string;
  specialty: string;
  /** The Google account that owns this physician's Doctor Dashboard. */
  email: string;
  availability: string;
  consultationMinutes: number;
  /** Fee in NPR. Defaults to the app-wide consultation fee. */
  fee: number;
  responseTime: string;
  languages: string[];
  yearsExperience: number;
  registration: string;
  verified: boolean;
}

export const FEATURED_DOCTOR: Physician = {
  id: 'pankaj-yadav',
  name: 'Dr. Pankaj Yadav',
  initials: 'PY',
  specialty: 'General Physician',
  email: 'Pankaj.ydv707@gmail.com',
  availability: 'Available Today',
  consultationMinutes: 30,
  fee: CONSULTATION_FEE,
  responseTime: 'Within the hour',
  languages: ['English', 'Nepali', 'Hindi'],
  yearsExperience: 12,
  registration: 'NMC Reg. 00000',
  verified: true,
};

/** All physicians shown publicly. One today; the model scales to many. */
export const PHYSICIANS: Physician[] = [FEATURED_DOCTOR];

/** Formatted consultation fee for display (e.g. "Rs. 800"). */
export const FEATURED_DOCTOR_FEE = formatNpr(FEATURED_DOCTOR.fee);

/** Lower-cased doctor emails — the authoritative allow-list for the doctor role. */
export const DOCTOR_EMAILS: readonly string[] = PHYSICIANS.map((p) =>
  p.email.trim().toLowerCase(),
);

/**
 * True when an email owns a Doctor Dashboard. Case-insensitive. This is the ONE
 * place the app decides "is this account a doctor?" — used by the auth layer to
 * auto-assign the role. The Firestore rules enforce the same allow-list so the
 * role can never be spoofed client-side.
 */
export function isDoctorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DOCTOR_EMAILS.includes(email.trim().toLowerCase());
}
