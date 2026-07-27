import {
  JOIN_WINDOW_AFTER_MS,
  JOIN_WINDOW_BEFORE_MS,
  isClosedStatus,
  isJoinableStatus,
} from '../config/video.js';
import type { Consultation, ConsultationStatus } from '../types/consultation.js';
import type { JoinWindow, VideoRoomStatus } from '../types/video.js';

// ============================================================================
// The join gate — one pure function, used everywhere.
//
// Intentionally free of React, of Firestore reads and of any Timestamp type:
// it decides purely from plain values, so the SAME implementation runs in the
// browser (to render the button) and in the serverless API (to decide whether
// to mint a token). The client copy governs UI only; the server call is the
// actual security boundary, and because both run this code they can never
// disagree about whether a consultation is joinable.
// ============================================================================

/** The minimum a caller must supply to evaluate the gate. */
export interface JoinWindowInput {
  status: ConsultationStatus;
  videoRoomId?: string;
  videoRoomStatus?: VideoRoomStatus;
  /** Scheduled start in epoch ms, or null for "Consult Now". */
  scheduledAtMs: number | null;
}

const CLOSED: JoinWindow = { canJoin: false, reason: 'ended', msUntilOpen: 0, opensAt: null };

/** Adapter for the client-side Consultation document. */
export function evaluateJoinWindow(c: Consultation, nowMs: number = Date.now()): JoinWindow {
  return evaluateJoinWindowFrom(
    {
      status: c.status,
      videoRoomId: c.videoRoomId,
      videoRoomStatus: c.videoRoomStatus,
      scheduledAtMs: c.scheduledAt?.toMillis() ?? null,
    },
    nowMs,
  );
}

export function evaluateJoinWindowFrom(c: JoinWindowInput, nowMs: number = Date.now()): JoinWindow {
  // Terminal consultation states close the door for good.
  if (isClosedStatus(c.status)) return CLOSED;

  // Not yet approved by a doctor → no room may exist at all.
  if (!isJoinableStatus(c.status)) {
    return { canJoin: false, reason: 'not_approved', msUntilOpen: 0, opensAt: null };
  }

  if (!c.videoRoomId) {
    return { canJoin: false, reason: 'no_room', msUntilOpen: 0, opensAt: null };
  }

  switch (c.videoRoomStatus) {
    case 'ended':
      return CLOSED;
    case 'expired':
      return { canJoin: false, reason: 'expired', msUntilOpen: 0, opensAt: null };
    case 'failed':
      return { canJoin: false, reason: 'no_room', msUntilOpen: 0, opensAt: null };
    default:
      break;
  }

  // "Consult Now" — no scheduled time, so approval alone opens the door.
  const scheduledMs = c.scheduledAtMs;
  if (scheduledMs === null) {
    return { canJoin: true, reason: null, msUntilOpen: 0, opensAt: null };
  }

  const opensAtMs = scheduledMs - JOIN_WINDOW_BEFORE_MS;
  const closesAtMs = scheduledMs + JOIN_WINDOW_AFTER_MS;

  if (nowMs < opensAtMs) {
    return {
      canJoin: false,
      reason: 'too_early',
      msUntilOpen: opensAtMs - nowMs,
      opensAt: new Date(opensAtMs),
    };
  }
  if (nowMs > closesAtMs) {
    return { canJoin: false, reason: 'expired', msUntilOpen: 0, opensAt: null };
  }
  return { canJoin: true, reason: null, msUntilOpen: 0, opensAt: new Date(opensAtMs) };
}

/**
 * "Available in 13 minutes" / "Available in 2 hours 5 minutes".
 * Rounds up so a 12m30s wait never reads as the "12 minutes" that already passed.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Available now';
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 60) {
    return `Available in ${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return minutes === 0 ? `Available in ${h}` : `Available in ${h} ${minutes} min`;
}

/** Human copy for why joining is blocked — shown in place of the Join button. */
export const JOIN_BLOCK_COPY: Record<NonNullable<JoinWindow['reason']>, string> = {
  not_approved: 'Waiting for your doctor to approve this consultation.',
  too_early: 'Your consultation room opens shortly before the scheduled time.',
  ended: 'This consultation has ended.',
  expired: 'This consultation room has expired.',
  no_room: 'The consultation room is being prepared.',
  not_participant: 'You do not have access to this consultation.',
};

/** mm:ss for the in-call elapsed timer. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
