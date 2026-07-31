import type { Timestamp } from 'firebase/firestore';
import type { ConsultationStatus } from './consultation';

// ============================================================================
// MeroDoctor — messaging types
//
// A `conversation` is the persistent doctor↔patient channel for ONE booking
// (its id equals the consultation id). Messages live in a subcollection. This
// is separate from the ephemeral in-call `consultationMessages` chat.
// ============================================================================

export type MessageSenderRole = 'patient' | 'doctor';

/**
 * Message kinds. V1 only *sends* `text` and `system`; the rest are modelled now
 * so the schema is future-ready (medical documents, attachments, voice) without
 * a later migration. Rendering falls back to text for unknown/stub types.
 */
export type MessageType =
  | 'text'
  | 'system'
  | 'prescription'
  | 'certificate'
  | 'lab_request'
  | 'appointment'
  | 'consultation_link'
  | 'image' // future
  | 'pdf' // future
  | 'voice'; // future

/** `conversations/{consultationId}/messages/{id}` */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: MessageSenderRole;
  senderName: string;
  type: MessageType;
  text: string;
  /** Type-specific payload (e.g. prescription link, appointment time). */
  meta?: Record<string, unknown>;
  createdAt: Timestamp | null;
  /** uids that have received the message (best-effort delivery receipt). */
  deliveredTo: string[];
  /** uids that have read the message. */
  readBy: string[];
  /** Soft delete — sender only; keeps the audit trail intact. */
  deleted?: boolean;
}

/** Compact preview stored on the conversation so lists cost no message reads. */
export interface ConversationPreview {
  text: string;
  senderId: string;
  senderRole: MessageSenderRole;
  type: MessageType;
  at: Timestamp | null;
}

/** `conversations/{conversationId}` — one per booking (`id === consultationId`). */
export interface Conversation {
  id: string;
  consultationId: string;
  bookingId: string;
  doctorId: string;
  patientId: string;
  /** [patientId, doctorId] — drives the read rule without a second lookup. */
  participantIds: string[];
  patientName: string;
  doctorName: string;
  /** Denormalised consultation status for previews/filters. */
  status: ConsultationStatus;
  lastMessage: ConversationPreview | null;
  /** Per-participant unread counters, keyed by uid. */
  unread: Record<string, number>;
  /** Per-participant last-read time, keyed by uid. */
  lastReadAt: Record<string, Timestamp | null>;
  /**
   * When the complimentary follow-up window closes. `null` while the
   * consultation is active; set to completed + FOLLOW_UP_DAYS on completion.
   * After it passes the conversation is read-only.
   */
  followUpExpiresAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  // ---- reserved for Stage 2 (fields present so no migration is needed) ----
  pinnedBy?: string[];
  archivedBy?: string[];
}

/** `conversations/{conversationId}/typing/{uid}` — ephemeral typing presence. */
export interface TypingState {
  uid: string;
  at: Timestamp | null;
}

/** Doctor messaging-center filter tabs. */
export type ConversationFilter = 'all' | 'today' | 'active' | 'completed' | 'follow_up';

// ---------------------------------------------------------------------------
// Typed `meta` payloads for structured (medical) messages. `meta` on the
// Message stays `Record<string, unknown>` at rest; these interfaces document
// and type each shape at the send/render call sites.
// ---------------------------------------------------------------------------

export interface PrescribedMedication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
}

/** meta for a `prescription` message — a snapshot embedded at send time. */
export interface PrescriptionMeta {
  consultationId: string;
  medications: PrescribedMedication[];
  advice: string;
}

/** meta for `appointment` messages (also used for follow-up reminders). */
export interface AppointmentMeta {
  /** ISO timestamp of the appointment/follow-up. */
  at: string;
  note?: string;
  /** True when this is a follow-up reminder rather than a fresh appointment. */
  followUp?: boolean;
}

/** meta for a `consultation_link` message. */
export interface ConsultationLinkMeta {
  consultationId: string;
}
