import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatSenderRole, ConsultationMessage } from '../types/video';

// ============================================================================
// In-consultation secure messaging (text only, persisted, auditable).
//
// `participantIds` is written onto every message so the security rules can
// authorise reads without an extra document lookup per message — that is what
// keeps a live chat subscription both cheap and enforceable.
// ============================================================================

const MESSAGES = 'consultationMessages';

/** Matches the ceiling enforced by the Firestore rules. */
export const MAX_MESSAGE_LENGTH = 2000;

export function subscribeConsultationMessages(
  consultationId: string,
  cb: (messages: ConsultationMessage[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  // Owner-filtered only, sorted client-side — avoids a composite index, and a
  // consultation's message count is far too small for this to matter.
  const q = query(collection(db, MESSAGES), where('consultationId', '==', consultationId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ConsultationMessage);
      list.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      cb(list);
    },
    (err) => {
      console.error('[chat] subscribe error', err);
      onError?.(err);
    },
  );
}

export interface ChatSender {
  uid: string;
  name: string;
  role: ChatSenderRole;
  participantIds: string[];
}

/** Send one message. Throws so the composer can surface a retry affordance. */
export async function sendConsultationMessage(
  consultationId: string,
  sender: ChatSender,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, MESSAGES), {
    consultationId,
    senderId: sender.uid,
    senderRole: sender.role,
    senderName: sender.name,
    text: trimmed.slice(0, MAX_MESSAGE_LENGTH),
    createdAt: serverTimestamp(),
    participantIds: sender.participantIds,
  });
}
