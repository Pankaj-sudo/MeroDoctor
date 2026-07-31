import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useConversation } from '../../hooks/useConversation';
import { useMessages } from '../../hooks/useMessages';
import { useTyping } from '../../hooks/useTyping';
import { deleteOwnMessage, sendMessage } from '../../services/messageService';
import { MessageBubble } from './MessageBubble';
import { MedicalActions } from './MedicalActions';
import { Composer } from './Composer';
import { Spinner } from '../Spinner';
import '../../styles/messaging.css';

// ============================================================================
// The chat window — shared by the patient panel and the doctor messaging
// center. Owns: realtime messages, date separators + grouping, auto-scroll,
// infinite scroll upward, typing indicator, read receipts, and the follow-up
// read-only lock. Everything role-specific comes from `useConversation`.
// ============================================================================

export function MessageThread({
  conversationId,
  onBack,
  compact = false,
}: {
  conversationId: string;
  /** Mobile "back to list" affordance; omitted on desktop split view. */
  onBack?: () => void;
  compact?: boolean;
}) {
  const { user, profile } = useAuth();
  const { loading: convLoading, role, peerUid, peerName, gate } =
    useConversation(conversationId);
  const { rows, loading, error, hasMore, loadingMore, loadOlder, bottomSignal } = useMessages(
    conversationId,
    user?.uid,
  );
  const { peerTyping, notifyTyping } = useTyping(conversationId, user?.uid);

  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  const displayName = profile?.displayName || user?.displayName || user?.email || 'You';

  // Track whether the user is pinned to the bottom (so new messages auto-scroll
  // but reading history isn't yanked away).
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    // Near the top → pull older messages.
    if (el.scrollTop < 60 && hasMore && !loadingMore) {
      const prevHeight = el.scrollHeight;
      void loadOlder().then(() => {
        // Preserve scroll position after prepending older messages.
        requestAnimationFrame(() => {
          const el2 = scrollRef.current;
          if (el2) el2.scrollTop = el2.scrollHeight - prevHeight + el2.scrollTop;
        });
      });
    }
  }, [hasMore, loadingMore, loadOlder]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [bottomSignal, peerTyping]);

  const handleSend = async (text: string) => {
    if (!user || !peerUid) return;
    setSending(true);
    stickBottomRef.current = true;
    try {
      await sendMessage(
        conversationId,
        { uid: user.uid, name: displayName, role, peerUid },
        { text },
      );
    } catch (err) {
      console.error('[thread] send failed', err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (id: string) => {
    void deleteOwnMessage(conversationId, id);
  };

  const peerInitials = (peerName || '·')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section className={`m-thread ${compact ? 'm-thread--compact' : ''}`} aria-label="Conversation">
      <header className="m-thread__head">
        {onBack ? (
          <button type="button" className="m-thread__back" onClick={onBack} aria-label="Back">
            ‹
          </button>
        ) : null}
        <div className="m-thread__avatar" aria-hidden="true">
          {peerInitials}
        </div>
        <div className="m-thread__id">
          <span className="m-thread__name">{peerName || 'Conversation'}</span>
          <span className="m-thread__sub">
            {peerTyping ? (
              <span className="m-thread__typing">typing…</span>
            ) : role === 'doctor' ? (
              'Patient'
            ) : (
              'Your clinician'
            )}
          </span>
        </div>
      </header>

      <div className="m-thread__scroll" ref={scrollRef} onScroll={onScroll}>
        {loadingMore ? (
          <div className="m-thread__more">
            <Spinner size={16} />
          </div>
        ) : null}

        {(loading || convLoading) && rows.length === 0 ? (
          <div className="m-thread__empty">
            <Spinner size={20} />
          </div>
        ) : null}

        {error ? <div className="m-thread__empty m-thread__empty--error">{error}</div> : null}

        {!loading && rows.length === 0 && !error ? (
          <div className="m-thread__empty">
            <p>
              {role === 'doctor'
                ? 'No messages yet. Say hello to your patient.'
                : 'Start the conversation with your doctor. Ask a question about your care.'}
            </p>
          </div>
        ) : null}

        {rows.map((row) =>
          row.kind === 'day' ? (
            <div key={row.id} className="m-day">
              <span>{row.label}</span>
            </div>
          ) : (
            <MessageBubble
              key={row.id}
              message={row.message}
              mine={row.message.senderId === user?.uid}
              endsGroup={row.endsGroup}
              peerRead={peerUid ? row.message.readBy.includes(peerUid) : false}
              onDelete={handleDelete}
            />
          ),
        )}

        {peerTyping ? (
          <div className="m-row is-theirs">
            <div className="m-bubble m-bubble--typing" aria-label={`${peerName} is typing`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>

      {gate.followUpEnded ? (
        <div className="m-followup" role="status">
          {gate.notice}
        </div>
      ) : null}

      <Composer
        disabled={!gate.canSend}
        sending={sending}
        onSend={(t) => void handleSend(t)}
        onTyping={notifyTyping}
        placeholder={role === 'doctor' ? `Message ${peerName || 'patient'}…` : 'Write a message…'}
        leading={
          // Doctor-only: send structured clinical documents (prescription,
          // certificate, lab request, appointment/follow-up, video link).
          role === 'doctor' && user && peerUid ? (
            <MedicalActions
              conversationId={conversationId}
              consultationId={conversationId}
              sender={{ uid: user.uid, name: displayName, role, peerUid }}
            />
          ) : undefined
        }
      />
    </section>
  );
}
