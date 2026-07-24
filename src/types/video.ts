import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// MeroDoctor — video consultation types
//
// The app is deliberately NOT coupled to Daily.co. `VideoProviderId` names the
// backend that owns a room; every room document records which provider created
// it, so rooms created by one provider keep working after the default changes.
// To add Zoom/LiveKit/Agora/Twilio: add the id here, implement the server-side
// RoomProvider (api/_lib/providers) and the client CallSession
// (src/services/video) — nothing else in the app needs to change.
// ============================================================================

export type VideoProviderId = 'daily' | 'livekit' | 'zoom' | 'agora' | 'twilio' | 'meet';

/**
 * Lifecycle of a consultation room.
 *  created → the provider room exists, nobody has joined yet
 *  active  → at least one participant has joined
 *  ended   → the doctor ended the consultation (join is closed)
 *  expired → the room passed its expiry without being ended
 *  failed  → room creation failed at the provider (surfaced to the doctor)
 */
export type VideoRoomStatus = 'created' | 'active' | 'ended' | 'expired' | 'failed';

/**
 * `videoRooms/{consultationId}` — exactly ONE room per booking, enforced
 * structurally by using the consultation id as the document id. The provider
 * room *name* additionally carries random entropy so it can never be guessed
 * from the consultation id, and is never reused: ending a room and starting a
 * new one mints a fresh name.
 */
export interface VideoRoom {
  /** Document id — always equal to `consultationId`. */
  id: string;
  consultationId: string;
  /** The booking this room belongs to. Same value as `consultationId`; kept
   *  explicit so the room document is self-describing in exports/audits. */
  bookingId: string;
  provider: VideoProviderId;
  /** Provider-side room identifier (Daily's room `id`). */
  roomId: string;
  /** Provider-side room name — the unguessable slug used in the URL. */
  roomName: string;
  /** Full join URL. Useless on its own: rooms are private and require a
   *  server-minted meeting token, so a leaked URL grants no access. */
  roomUrl: string;
  doctorId: string;
  patientId: string;
  /** [patientId, doctorId] — lets security rules authorise a read without an
   *  extra `get()` on the consultation for every document. */
  participantIds: string[];
  status: VideoRoomStatus;
  createdAt: Timestamp | null;
  /** Hard stop enforced by the provider itself, not just by our UI. */
  expiresAt: Timestamp | null;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  createdBy: string;
  /** Populated when `status === 'failed'`. */
  error?: string;
}

export type ChatSenderRole = 'patient' | 'doctor';

/** `consultationMessages/{id}` — in-consultation secure messaging. Text only. */
export interface ConsultationMessage {
  id: string;
  consultationId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  senderName: string;
  text: string;
  createdAt: Timestamp | null;
  /** Mirrors VideoRoom.participantIds — drives the read rule. */
  participantIds: string[];
}

/**
 * Types of realtime consultation events. These drive the "is the other person
 * here yet?" waiting-room state and form an audit trail of the call itself.
 */
export type ConsultationEventType =
  | 'room_created'
  | 'participant_joined'
  | 'participant_left'
  | 'connection_changed'
  | 'consultation_started'
  | 'consultation_ended';

/** `consultationEvents/{id}` — realtime presence + call audit trail. */
export interface ConsultationEvent {
  id: string;
  consultationId: string;
  type: ConsultationEventType;
  actorId: string;
  actorRole: ChatSenderRole;
  actorName: string;
  at: Timestamp | null;
  participantIds: string[];
  /** Free-form detail (e.g. connection quality label). */
  detail?: string;
}

/**
 * The short-lived credential the client needs to join. Minted server-side per
 * user, per consultation — never stored in Firestore and never cached.
 */
export interface JoinGrant {
  provider: VideoProviderId;
  roomUrl: string;
  roomName: string;
  /** Provider meeting token. Scoped to one room, one identity, short TTL. */
  token: string;
  /** Display name the provider should show for this participant. */
  userName: string;
  /** True when this participant may share their screen (doctor only). */
  canScreenShare: boolean;
  /** Epoch ms at which the token stops working. */
  expiresAtMs: number;
}

/** Why a participant cannot join right now — drives the UI copy. */
export type JoinBlockReason =
  | 'not_approved'
  | 'too_early'
  | 'ended'
  | 'expired'
  | 'no_room'
  | 'not_participant';

/** Result of evaluating the join window for a consultation. */
export interface JoinWindow {
  canJoin: boolean;
  reason: JoinBlockReason | null;
  /** ms until the window opens; 0 when it is open or will never open. */
  msUntilOpen: number;
  /** The moment the join button unlocks, when known. */
  opensAt: Date | null;
}
