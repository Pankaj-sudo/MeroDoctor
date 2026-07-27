import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sendConsultationMessage,
  subscribeConsultationMessages,
} from '../services/consultationChatService';
import type { ChatSender } from '../services/consultationChatService';
import type { ConsultationMessage } from '../types/video';

export interface UseConsultationChat {
  messages: ConsultationMessage[];
  loading: boolean;
  /** Set when the live subscription itself failed (e.g. rules denied). */
  error: string | null;
  sending: boolean;
  /** Set when the last send failed; cleared on the next attempt. */
  sendError: string | null;
  send: (text: string) => Promise<void>;
  /** Count of messages from the other participant — drives the unread badge. */
  incomingCount: number;
}

/** Live consultation chat for the signed-in participant. */
export function useConsultationChat(
  consultationId: string,
  sender: ChatSender | null,
): UseConsultationChat {
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!consultationId) return;
    setLoading(true);
    const unsubscribe = subscribeConsultationMessages(
      consultationId,
      (list) => {
        setMessages(list);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError('Messages are unavailable right now.');
      },
    );
    return unsubscribe;
  }, [consultationId]);

  const send = useCallback(
    async (text: string) => {
      if (!sender || !text.trim()) return;
      setSending(true);
      setSendError(null);
      try {
        await sendConsultationMessage(consultationId, sender, text);
      } catch (err) {
        console.error('[chat] send failed', err);
        setSendError('Message not sent. Tap to retry.');
      } finally {
        setSending(false);
      }
    },
    [consultationId, sender],
  );

  const incomingCount = useMemo(
    () => (sender ? messages.filter((m) => m.senderId !== sender.uid).length : 0),
    [messages, sender],
  );

  return { messages, loading, error, sending, sendError, send, incomingCount };
}
