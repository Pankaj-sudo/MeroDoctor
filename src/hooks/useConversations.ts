import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  subscribeAllConversations,
  subscribeUserConversations,
} from '../services/conversationService';
import { evaluateSendGate } from '../lib/conversationState';
import type { Conversation, ConversationFilter } from '../types/messaging';

export interface UseConversations {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  /** Total unread across all conversations for the signed-in user. */
  totalUnread: number;
}

/**
 * Live conversation list for the signed-in user. Staff (doctor/admin/clinic)
 * see ALL conversations for the messaging center; a patient sees only their own.
 */
export function useConversations(): UseConversations {
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStaff = role === 'doctor' || role === 'admin' || role === 'clinic_staff';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const cb = (list: Conversation[]) => {
      setConversations(list);
      setLoading(false);
      setError(null);
    };
    const onErr = () => {
      setLoading(false);
      setError('Conversations are unavailable right now.');
    };
    const unsub = isStaff
      ? subscribeAllConversations(cb, onErr)
      : subscribeUserConversations(user.uid, cb, onErr);
    return unsub;
  }, [user, isStaff]);

  const totalUnread = useMemo(
    () => (user ? conversations.reduce((sum, c) => sum + (c.unread?.[user.uid] ?? 0), 0) : 0),
    [conversations, user],
  );

  return { conversations, loading, error, totalUnread };
}

/** Filter + search conversations for the doctor messaging center. */
export function filterConversations(
  conversations: Conversation[],
  filter: ConversationFilter,
  search: string,
  nowMs: number = Date.now(),
): Conversation[] {
  const q = search.trim().toLowerCase();
  return conversations.filter((c) => {
    if (q && !`${c.patientName} ${c.lastMessage?.text ?? ''}`.toLowerCase().includes(q)) {
      return false;
    }
    switch (filter) {
      case 'today': {
        const at = c.lastMessage?.at?.toMillis() ?? c.updatedAt?.toMillis() ?? 0;
        return isSameDay(at, nowMs);
      }
      case 'active':
        return c.status !== 'completed';
      case 'completed':
        return c.status === 'completed';
      case 'follow_up': {
        // Completed but still inside the complimentary window.
        return c.status === 'completed' && !evaluateSendGate(c, 'doctor', nowMs).followUpEnded
          && c.followUpExpiresAt !== null;
      }
      default:
        return true;
    }
  });
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
