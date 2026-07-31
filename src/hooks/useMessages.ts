import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchOlderMessages,
  markMessagesRead,
  subscribeMessages,
  type MessagePage,
} from '../services/messageService';
import { markConversationRead } from '../services/conversationService';
import { GROUP_WINDOW_MS, MESSAGE_PAGE_SIZE } from '../config/messaging';
import { formatDaySeparator } from '../lib/conversationState';
import type { Message } from '../types/messaging';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

// ============================================================================
// useMessages — realtime + paginated messages for one conversation, plus the
// derived rendering model (date separators + sender grouping) and automatic
// read-receipt / unread clearing for the signed-in user.
// ============================================================================

export type ThreadRow =
  | { kind: 'day'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      message: Message;
      /** First in a run from the same sender → show the name/avatar gap. */
      startsGroup: boolean;
      /** Last in a run → show the timestamp + receipt. */
      endsGroup: boolean;
    };

export interface UseMessages {
  rows: ThreadRow[];
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadOlder: () => Promise<void>;
  /** Increments whenever new messages arrive at the bottom (for auto-scroll). */
  bottomSignal: number;
}

export function useMessages(
  conversationId: string | undefined,
  viewerUid: string | undefined,
): UseMessages {
  const [live, setLive] = useState<MessagePage>({ messages: [], cursor: null, hasMore: false });
  const [older, setOlder] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bottomSignal, setBottomSignal] = useState(0);

  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const lastCountRef = useRef(0);
  const readSetRef = useRef<Set<string>>(new Set());

  // Reset all state when switching conversations.
  useEffect(() => {
    setOlder([]);
    setLive({ messages: [], cursor: null, hasMore: false });
    setLoading(true);
    lastCountRef.current = 0;
    readSetRef.current = new Set();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeMessages(
      conversationId,
      MESSAGE_PAGE_SIZE,
      (page) => {
        setLive(page);
        cursorRef.current = page.cursor;
        setLoading(false);
        setError(null);
        // Signal the view to stick to the bottom when the newest count grows.
        if (page.messages.length > lastCountRef.current) setBottomSignal((s) => s + 1);
        lastCountRef.current = page.messages.length;
      },
      () => {
        setLoading(false);
        setError('Messages are unavailable right now.');
      },
    );
    return unsub;
  }, [conversationId]);

  // Auto mark-read: any incoming message from the peer the viewer hasn't read.
  useEffect(() => {
    if (!conversationId || !viewerUid) return;
    const unread = live.messages.filter(
      (m) => m.senderId !== viewerUid && !m.readBy.includes(viewerUid) && !readSetRef.current.has(m.id),
    );
    if (unread.length === 0) return;
    unread.forEach((m) => readSetRef.current.add(m.id));
    void markMessagesRead(conversationId, unread.map((m) => m.id), viewerUid);
    void markConversationRead(conversationId, viewerUid);
  }, [live.messages, conversationId, viewerUid]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingMore || !cursorRef.current || !live.hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchOlderMessages(conversationId, cursorRef.current);
      setOlder((prev) => [...page.messages, ...prev]);
      cursorRef.current = page.cursor;
      setLive((prev) => ({ ...prev, hasMore: page.hasMore }));
    } catch (err) {
      console.error('[messages] loadOlder failed', err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, live.hasMore]);

  // Merge older + live, dedupe (a message can briefly appear in both windows).
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const merged: Message[] = [];
    for (const m of [...older, ...live.messages]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      merged.push(m);
    }
    return merged;
  }, [older, live.messages]);

  const rows = useMemo(() => buildRows(messages), [messages]);

  return {
    rows,
    messages,
    loading,
    error,
    hasMore: live.hasMore,
    loadingMore,
    loadOlder,
    bottomSignal,
  };
}

/** Interleave day separators and compute per-message grouping flags. */
function buildRows(messages: Message[]): ThreadRow[] {
  const rows: ThreadRow[] = [];
  let lastDayKey = '';
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const at = m.createdAt?.toDate() ?? null;
    const dayKey = at ? at.toDateString() : 'pending';
    if (dayKey !== lastDayKey) {
      rows.push({ kind: 'day', id: `day-${dayKey}-${i}`, label: at ? formatDaySeparator(at) : 'Now' });
      lastDayKey = dayKey;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameSenderClose = (a?: Message, b?: Message) =>
      !!a && !!b && a.senderId === b.senderId && closeInTime(a, b);
    rows.push({
      kind: 'message',
      id: m.id,
      message: m,
      startsGroup: !sameSenderClose(prev, m) || (prev?.createdAt?.toDate()?.toDateString() ?? '') !== dayKey,
      endsGroup: !sameSenderClose(m, next),
    });
  }
  return rows;
}

function closeInTime(a: Message, b: Message): boolean {
  const at = a.createdAt?.toMillis();
  const bt = b.createdAt?.toMillis();
  if (at == null || bt == null) return true;
  return Math.abs(bt - at) <= GROUP_WINDOW_MS;
}
