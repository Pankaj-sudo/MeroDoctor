import type { ConsultationStatus } from '../types/consultation';
import type { VideoProviderId } from '../types/video';

// ============================================================================
// MeroDoctor — video consultation configuration.
// Single source of truth for every timing/threshold value used by the join
// gate, the room lifecycle and the call UI. Nothing here is hardcoded at a
// call site; both the client and the serverless API import these constants so
// the two can never drift apart.
// ============================================================================

/** The provider new rooms are created with. Existing rooms keep their own. */
export const DEFAULT_VIDEO_PROVIDER: VideoProviderId = 'daily';

/** How long before a *scheduled* start the Join button unlocks. */
export const JOIN_WINDOW_BEFORE_MINUTES = 15;

/**
 * How long after the scheduled start joining stays possible. Generous on
 * purpose: a patient who is late should still reach their doctor rather than
 * being locked out of a consultation they paid for.
 */
export const JOIN_WINDOW_AFTER_MINUTES = 60;

/** Provider-enforced room lifetime, measured from creation. */
export const ROOM_TTL_MINUTES = 180;

/** Meeting-token lifetime. Short — it is re-minted on every join attempt. */
export const JOIN_TOKEN_TTL_MINUTES = 60;

/** Nominal consultation length, used by the in-call timer's progress ring. */
export const CONSULTATION_MINUTES = 30;

export const JOIN_WINDOW_BEFORE_MS = JOIN_WINDOW_BEFORE_MINUTES * 60_000;
export const JOIN_WINDOW_AFTER_MS = JOIN_WINDOW_AFTER_MINUTES * 60_000;

/**
 * Statuses at which a consultation has been approved by the doctor and its
 * video room may exist and be joined. Deliberately excludes every pre-approval
 * status (payment still unverified) and both terminal states.
 */
export const JOINABLE_STATUSES: readonly ConsultationStatus[] = [
  'doctor_assigned',
  'doctor_reviewing',
  'doctor_contacting',
  'in_progress',
];

/** Terminal statuses — joining is permanently closed. */
export const CLOSED_STATUSES: readonly ConsultationStatus[] = ['prescription_ready', 'completed'];

export function isJoinableStatus(status: ConsultationStatus): boolean {
  return JOINABLE_STATUSES.includes(status);
}

export function isClosedStatus(status: ConsultationStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}
