import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeConversation } from '../services/conversationService';
import { evaluateSendGate, type SendGate } from '../lib/conversationState';
import type { Conversation, MessageSenderRole } from '../types/messaging';

export interface UseConversation {
  conversation: Conversation | null;
  loading: boolean;
  error: string | null;
  /** The signed-in user's role within this conversation. */
  role: MessageSenderRole;
  /** The other participant's uid (for unread bumps / receipts). */
  peerUid: string;
  peerName: string;
  /** Send permission + follow-up read-only state. */
  gate: SendGate;
}

/** Live conversation document + derived send-gate for the signed-in user. */
export function useConversation(conversationId: string | undefined): UseConversation {
  const { user, role: authRole } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDoctorSide =
    authRole === 'doctor' || authRole === 'admin' || authRole === 'clinic_staff';
  const role: MessageSenderRole = isDoctorSide ? 'doctor' : 'patient';

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeConversation(
      conversationId,
      (c) => {
        setConversation(c);
        setLoading(false);
        setError(c ? null : null);
      },
      () => {
        setLoading(false);
        setError('This conversation is unavailable.');
      },
    );
    return unsub;
  }, [conversationId]);

  const gate = useMemo(() => evaluateSendGate(conversation, role), [conversation, role]);

  const peerUid = useMemo(() => {
    if (!conversation || !user) return '';
    return conversation.participantIds.find((id) => id !== user.uid) ?? '';
  }, [conversation, user]);

  const peerName = conversation
    ? role === 'doctor'
      ? conversation.patientName
      : conversation.doctorName
    : '';

  return { conversation, loading, error, role, peerUid, peerName, gate };
}
