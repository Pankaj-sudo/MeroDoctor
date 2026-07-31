import type { ConsultationStatus } from '../types/consultation';

// ============================================================================
// Messaging configuration — single source of truth for every timing/threshold
// value. Shared by the client and (where relevant) the security rules' intent.
// ============================================================================

/** Complimentary post-consultation follow-up window, in days. */
export const FOLLOW_UP_DAYS = 7;
export const FOLLOW_UP_MS = FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;

/** A typing indicator is "live" only if the peer's typing doc is newer than this. */
export const TYPING_TTL_MS = 5000;

/** How often the composer refreshes the typing doc while the user types. */
export const TYPING_HEARTBEAT_MS = 3000;

/** Page size for message pagination / infinite scroll. */
export const MESSAGE_PAGE_SIZE = 30;

/** Matches the ceiling enforced by the Firestore rules. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Two messages from the same sender within this gap are visually grouped. */
export const GROUP_WINDOW_MS = 3 * 60 * 1000;

/**
 * Statuses at which a conversation exists and is active (composer enabled while
 * within the follow-up window). A conversation is created on approval, so this
 * begins at `doctor_assigned`.
 */
export const CONVERSATION_STATUSES: readonly ConsultationStatus[] = [
  'doctor_assigned',
  'doctor_reviewing',
  'doctor_contacting',
  'in_progress',
  'prescription_ready',
  'completed',
];

export function conversationExistsForStatus(status: ConsultationStatus): boolean {
  return CONVERSATION_STATUSES.includes(status);
}

export const FOLLOW_UP_ENDED_PATIENT_COPY =
  'Your complimentary follow-up period has ended. Please book a new consultation to continue chatting.';
