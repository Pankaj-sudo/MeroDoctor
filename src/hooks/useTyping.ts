import { useCallback, useEffect, useRef, useState } from 'react';
import { setTyping, subscribeTyping } from '../services/conversationService';
import { TYPING_HEARTBEAT_MS, TYPING_TTL_MS } from '../config/messaging';

export interface UseTyping {
  /** True when the OTHER participant is currently typing. */
  peerTyping: boolean;
  /** Call on each keystroke; throttled writes + auto-expiry. */
  notifyTyping: () => void;
}

/**
 * Two-way typing presence for one conversation.
 *  - Publishes the signed-in user's typing (throttled to one write per
 *    heartbeat) so we never spam Firestore per keystroke.
 *  - Subscribes to peers and reports "typing" only while a peer's doc is fresh
 *    (< TYPING_TTL_MS old), re-checking on a light timer so it clears itself.
 */
export function useTyping(
  conversationId: string | undefined,
  selfUid: string | undefined,
): UseTyping {
  const [peerTyping, setPeerTyping] = useState(false);
  const lastSentRef = useRef(0);
  // Latest peer typing timestamps (ms), keyed by uid — excludes self.
  const peersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setPeerTyping(false);
    peersRef.current = new Map();
    if (!conversationId) return;

    const unsub = subscribeTyping(conversationId, (states) => {
      const map = new Map<string, number>();
      for (const s of states) {
        if (s.uid === selfUid) continue;
        map.set(s.uid, s.at?.toMillis() ?? 0);
      }
      peersRef.current = map;
      recompute();
    });

    // Re-evaluate freshness on a light interval so a stale "typing" clears.
    const timer = setInterval(recompute, 1500);
    function recompute() {
      const now = Date.now();
      let any = false;
      for (const at of peersRef.current.values()) {
        if (now - at < TYPING_TTL_MS) any = true;
      }
      setPeerTyping(any);
    }

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [conversationId, selfUid]);

  const notifyTyping = useCallback(() => {
    if (!conversationId || !selfUid) return;
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_HEARTBEAT_MS) return;
    lastSentRef.current = now;
    void setTyping(conversationId, selfUid);
  }, [conversationId, selfUid]);

  return { peerTyping, notifyTyping };
}
