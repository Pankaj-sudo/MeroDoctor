import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FOLLOW_UP_MS } from '../config/messaging';
import type { Consultation } from '../types/consultation';
import type { Conversation, TypingState } from '../types/messaging';

// ============================================================================
// Conversation service — the persistent doctor↔patient channel (one per
// booking, conversationId === consultationId). Reads are realtime Firestore
// subscriptions; writes are limited to what the security rules permit for each
// role (the rules are the boundary, this is the convenience layer).
// ============================================================================

const CONVERSATIONS = 'conversations';
const TYPING = 'typing';

export const conversationRef = (conversationId: string) => doc(db, CONVERSATIONS, conversationId);

/**
 * Create the conversation for a consultation, if it doesn't already exist.
 * Idempotent (doc id === consultation id), so calling it again on re-approval is
 * harmless. Loads the consultation itself so the caller only needs the id — this
 * is the single entry point used by the doctor's approve/assign actions.
 */
export async function ensureConversation(
  consultationId: string,
  doctor: { uid: string; name: string },
): Promise<void> {
  const ref = conversationRef(consultationId);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  const cSnap = await getDoc(doc(db, 'consultations', consultationId));
  if (!cSnap.exists()) return;
  const consultation = { id: cSnap.id, ...cSnap.data() } as Consultation;

  const doctorId = consultation.assignedDoctorId || doctor.uid;
  await setDoc(ref, {
    consultationId,
    bookingId: consultationId,
    doctorId,
    patientId: consultation.patientId,
    participantIds: [consultation.patientId, doctorId],
    patientName: consultation.patient?.fullName?.trim() || 'Patient',
    doctorName: consultation.assignedDoctorName || doctor.name,
    status: consultation.status,
    lastMessage: null,
    unread: {},
    lastReadAt: {},
    followUpExpiresAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    pinnedBy: [],
    archivedBy: [],
  });
}

/** Keep the conversation's denormalised status in step with the consultation. */
export async function syncConversationStatus(
  consultationId: string,
  status: Consultation['status'],
): Promise<void> {
  try {
    await updateDoc(conversationRef(consultationId), { status, updatedAt: serverTimestamp() });
  } catch (err) {
    // A missing conversation (pre-approval consultation) is fine to ignore.
    console.warn('[conversation] status sync skipped', err);
  }
}

/**
 * Open the complimentary follow-up window: the conversation stays writable until
 * now + FOLLOW_UP_DAYS, then becomes read-only (enforced by the rules too).
 */
export async function startFollowUpWindow(consultationId: string): Promise<void> {
  try {
    await updateDoc(conversationRef(consultationId), {
      followUpExpiresAt: Timestamp.fromMillis(Date.now() + FOLLOW_UP_MS),
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[conversation] follow-up window skipped', err);
  }
}

/** Live-subscribe to one conversation. */
export function subscribeConversation(
  conversationId: string,
  cb: (c: Conversation | null) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    conversationRef(conversationId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Conversation) : null),
    (err) => {
      console.error('[conversation] subscribe error', err);
      onError?.(err);
    },
  );
}

/**
 * Live-subscribe to every conversation a user participates in, newest activity
 * first. Filtered by membership only (no composite index) and sorted client-side.
 * Works for both the patient (their few) and staff (`array-contains` their uid);
 * staff see all via the dedicated all-conversations subscription below.
 */
export function subscribeUserConversations(
  uid: string,
  cb: (list: Conversation[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, CONVERSATIONS), where('participantIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => cb(sortByActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Conversation))),
    (err) => {
      console.error('[conversation] list error', err);
      onError?.(err);
    },
  );
}

/** Live-subscribe to ALL conversations (doctor messaging center). */
export function subscribeAllConversations(
  cb: (list: Conversation[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, CONVERSATIONS),
    (snap) => cb(sortByActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Conversation))),
    (err) => {
      console.error('[conversation] all error', err);
      onError?.(err);
    },
  );
}

function sortByActivity(list: Conversation[]): Conversation[] {
  return list.sort((a, b) => {
    const at = a.lastMessage?.at?.toMillis() ?? a.updatedAt?.toMillis() ?? 0;
    const bt = b.lastMessage?.at?.toMillis() ?? b.updatedAt?.toMillis() ?? 0;
    return bt - at;
  });
}

/** Clear the signed-in user's unread counter and stamp their last-read time. */
export async function markConversationRead(conversationId: string, uid: string): Promise<void> {
  try {
    await updateDoc(conversationRef(conversationId), {
      [`unread.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[conversation] markRead skipped', err);
  }
}

/** Bump the OTHER participant's unread counter after sending. */
export async function bumpUnreadForPeer(conversationId: string, peerUid: string): Promise<void> {
  try {
    await updateDoc(conversationRef(conversationId), {
      [`unread.${peerUid}`]: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[conversation] bumpUnread skipped', err);
  }
}

// ---- typing presence ----
export function typingRef(conversationId: string, uid: string) {
  return doc(db, CONVERSATIONS, conversationId, TYPING, uid);
}

/** Write/refresh the signed-in user's typing presence. */
export async function setTyping(conversationId: string, uid: string): Promise<void> {
  try {
    await setDoc(typingRef(conversationId, uid), { uid, at: serverTimestamp() });
  } catch (err) {
    console.warn('[conversation] setTyping skipped', err);
  }
}

/** Live-subscribe to typing presence in a conversation. */
export function subscribeTyping(
  conversationId: string,
  cb: (states: TypingState[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, CONVERSATIONS, conversationId, TYPING),
    (snap) => cb(snap.docs.map((d) => d.data() as TypingState)),
    (err) => console.error('[conversation] typing error', err),
  );
}
