import { FOLLOW_UP_ENDED_PATIENT_COPY } from '../config/messaging';
import type { Conversation, MessageSenderRole } from '../types/messaging';

// ============================================================================
// Conversation send-gate — one pure function, used by the composer and mirrored
// by the Firestore rules (`followUpExpiresAt == null || now < followUpExpiresAt`).
// The rules are the real boundary; this drives the UI so the two never disagree.
// ============================================================================

export interface SendGate {
  canSend: boolean;
  /** True once the follow-up window has closed (conversation is read-only). */
  followUpEnded: boolean;
  /** Banner copy for the patient when read-only; empty when sendable. */
  notice: string;
}

export function evaluateSendGate(
  conversation: Conversation | null,
  role: MessageSenderRole,
  nowMs: number = Date.now(),
): SendGate {
  if (!conversation) {
    return { canSend: false, followUpEnded: false, notice: '' };
  }
  const expiresMs = conversation.followUpExpiresAt?.toMillis() ?? null;
  // `null` = still within the active consultation → always sendable.
  const followUpEnded = expiresMs !== null && nowMs >= expiresMs;
  if (!followUpEnded) {
    return { canSend: true, followUpEnded: false, notice: '' };
  }
  // Read-only after the window: the patient sees the upsell; the doctor keeps
  // read access and a quieter notice.
  return {
    canSend: false,
    followUpEnded: true,
    notice:
      role === 'patient'
        ? FOLLOW_UP_ENDED_PATIENT_COPY
        : 'The follow-up window for this consultation has ended — this conversation is read-only.',
  };
}

/** Human "2:45 PM" for a message row. */
export function formatMessageTime(at: Date | null): string {
  if (!at) return '';
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Date-separator label: "Today" / "Yesterday" / "Mon, 14 Jul". */
export function formatDaySeparator(at: Date, nowMs: number = Date.now()): string {
  const now = new Date(nowMs);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOf(now) - startOf(at)) / dayMs);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return at.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}
