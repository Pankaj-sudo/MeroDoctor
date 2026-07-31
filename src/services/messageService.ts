import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MAX_MESSAGE_LENGTH, MESSAGE_PAGE_SIZE } from '../config/messaging';
import { bumpUnreadForPeer } from './conversationService';
import { conversationRef } from './conversationService';
import type { Message, MessageSenderRole, MessageType } from '../types/messaging';

// ============================================================================
// Message service — CRUD for a conversation's message subcollection. Reads are
// realtime + paginated (newest window, extended backwards on scroll). Sending a
// message also updates the conversation's preview + peer unread counter.
// ============================================================================

const messagesCol = (conversationId: string) =>
  collection(db, 'conversations', conversationId, 'messages');

export interface Sender {
  uid: string;
  name: string;
  role: MessageSenderRole;
  peerUid: string;
}

export interface SendMessageInput {
  type?: MessageType;
  text: string;
  meta?: Record<string, unknown>;
}

/**
 * Send a message and update the conversation preview + peer unread in the same
 * logical step. Throws so the composer can offer a retry.
 */
export async function sendMessage(
  conversationId: string,
  sender: Sender,
  input: SendMessageInput,
): Promise<void> {
  const type = input.type ?? 'text';
  const text = input.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text && type === 'text') return;

  await addDoc(messagesCol(conversationId), {
    conversationId,
    senderId: sender.uid,
    senderRole: sender.role,
    senderName: sender.name,
    type,
    text,
    meta: input.meta ?? {},
    createdAt: serverTimestamp(),
    deliveredTo: [sender.uid],
    readBy: [sender.uid],
    deleted: false,
  });

  // Preview for the conversation list (no message reads needed to render it).
  await updateDoc(conversationRef(conversationId), {
    lastMessage: {
      text: type === 'text' ? text : previewFor(type, text),
      senderId: sender.uid,
      senderRole: sender.role,
      type,
      at: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });

  await bumpUnreadForPeer(conversationId, sender.peerUid);
}

function previewFor(type: MessageType, text: string): string {
  switch (type) {
    case 'prescription':
      return '📄 Prescription';
    case 'certificate':
      return '📑 Medical certificate';
    case 'lab_request':
      return '🧪 Lab request';
    case 'appointment':
      return '📅 Appointment';
    case 'consultation_link':
      return '🎥 Video consultation';
    case 'image':
      return '📷 Photo';
    case 'pdf':
      return '📎 Document';
    case 'voice':
      return '🎙️ Voice note';
    default:
      return text;
  }
}

export interface MessagePage {
  messages: Message[];
  /** Cursor for loading older messages; null when the start is reached. */
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Live-subscribe to the newest window of messages. Returns them oldest-first for
 * rendering. `pageSize` controls how many are watched; older pages are fetched
 * separately via `fetchOlderMessages`.
 */
export function subscribeMessages(
  conversationId: string,
  pageSize: number,
  cb: (page: MessagePage) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const q = query(
    messagesCol(conversationId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs;
      const messages = docs
        .map((d) => ({ id: d.id, ...d.data() }) as Message)
        .reverse(); // desc → ascending for display
      cb({
        messages,
        cursor: docs.length ? docs[docs.length - 1] : null,
        hasMore: docs.length === pageSize,
      });
    },
    (err) => {
      console.error('[message] subscribe error', err);
      onError?.(err);
    },
  );
}

/** One-shot fetch of an older page (infinite scroll upward). */
export async function fetchOlderMessages(
  conversationId: string,
  after: DocumentSnapshot,
  pageSize: number = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const { getDocs } = await import('firebase/firestore');
  const q = query(
    messagesCol(conversationId),
    orderBy('createdAt', 'desc'),
    startAfter(after),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  const docs = snap.docs;
  return {
    messages: docs.map((d) => ({ id: d.id, ...d.data() }) as Message).reverse(),
    cursor: docs.length ? docs[docs.length - 1] : null,
    hasMore: docs.length === pageSize,
  };
}

/** Mark a batch of messages read by the signed-in user (receipt bump only). */
export async function markMessagesRead(
  conversationId: string,
  messageIds: string[],
  uid: string,
): Promise<void> {
  await Promise.all(
    messageIds.map((id) =>
      updateDoc(doc(db, 'conversations', conversationId, 'messages', id), {
        readBy: arrayUnion(uid),
        deliveredTo: arrayUnion(uid),
      }).catch((err) => console.warn('[message] markRead skipped', id, err)),
    ),
  );
}

/** Soft-delete your own message (keeps the audit trail). */
export async function deleteOwnMessage(conversationId: string, messageId: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
    deleted: true,
  });
}
