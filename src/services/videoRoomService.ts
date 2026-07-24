import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { postJson } from '../lib/apiClient';
import type {
  ChatSenderRole,
  ConsultationEvent,
  ConsultationEventType,
  JoinGrant,
  VideoRoom,
} from '../types/video';

// ============================================================================
// Video room service.
//
// Mutations go through the serverless API (which owns the provider API key and
// re-validates authorisation); reads come straight from Firestore so the UI is
// realtime. The client never creates, edits or deletes a videoRooms document —
// the security rules deny that outright.
// ============================================================================

const VIDEO_ROOMS = 'videoRooms';
const CONSULTATION_EVENTS = 'consultationEvents';

/** Doctor action: provision the room for an approved consultation. */
export function createConsultationRoom(consultationId: string): Promise<{ roomUrl: string }> {
  return postJson<{ roomUrl: string }>('/api/consultations/room', { consultationId });
}

/**
 * Mint a join credential. Called immediately before joining and never cached —
 * tokens are short-lived by design, so a fresh one is cheaper than a stale one.
 */
export function requestJoinGrant(consultationId: string): Promise<JoinGrant> {
  return postJson<JoinGrant>('/api/consultations/join', { consultationId });
}

/** Doctor action: close the room permanently. */
export function endConsultationRoom(consultationId: string): Promise<void> {
  return postJson<unknown>('/api/consultations/end', { consultationId }).then(() => undefined);
}

/** Live-subscribe to the room document (status, expiry, provider). */
export function subscribeVideoRoom(
  consultationId: string,
  cb: (room: VideoRoom | null) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, VIDEO_ROOMS, consultationId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as VideoRoom) : null),
    (err) => {
      console.error('[video] room subscribe error', err);
      onError?.(err);
    },
  );
}

/** Live-subscribe to presence/audit events for a consultation, oldest first. */
export function subscribeConsultationEvents(
  consultationId: string,
  cb: (events: ConsultationEvent[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  // Filtered by consultation only (no composite index needed); sorted client-side.
  const q = query(collection(db, CONSULTATION_EVENTS), where('consultationId', '==', consultationId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ConsultationEvent);
      list.sort((a, b) => (a.at?.toMillis() ?? 0) - (b.at?.toMillis() ?? 0));
      cb(list);
    },
    (err) => {
      console.error('[video] events subscribe error', err);
      onError?.(err);
    },
  );
}

export interface EventActor {
  uid: string;
  name: string;
  role: ChatSenderRole;
  participantIds: string[];
}

/**
 * Append a presence/connection event. Fire-and-forget: a failed audit write
 * must never break an in-progress consultation, so errors are logged only.
 */
export async function logConsultationEvent(
  consultationId: string,
  actor: EventActor,
  type: ConsultationEventType,
  detail = '',
): Promise<void> {
  try {
    await addDoc(collection(db, CONSULTATION_EVENTS), {
      consultationId,
      type,
      actorId: actor.uid,
      actorRole: actor.role,
      actorName: actor.name,
      at: serverTimestamp(),
      participantIds: actor.participantIds,
      detail,
    });
  } catch (err) {
    console.error('[video] could not record event', type, err);
  }
}
