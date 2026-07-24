import { useEffect, useRef, useState } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../services/consultationChatService';
import type { ConsultationMessage } from '../../types/video';

function timeOf(message: ConsultationMessage): string {
  const at = message.createdAt?.toDate();
  if (!at) return 'Sending…'; // serverTimestamp() not yet resolved
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Secure in-consultation messaging. Text only, timestamped, persisted to
 * Firestore and readable only by the two participants.
 */
export function ChatPanel({
  messages,
  loading,
  error,
  sending,
  sendError,
  currentUserId,
  onSend,
  onClose,
}: {
  messages: ConsultationMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  sendError: string | null;
  currentUserId: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <aside className="v-chat" aria-label="Consultation messages">
      <header className="v-chat__head">
        <div>
          <h2 className="v-chat__title">Messages</h2>
          <p className="v-chat__note">Private to you and your clinician</p>
        </div>
        <button type="button" className="v-chat__close" onClick={onClose} aria-label="Close messages">
          ✕
        </button>
      </header>

      <div className="v-chat__list" ref={listRef}>
        {loading ? <p className="v-chat__empty">Loading messages…</p> : null}
        {error ? <p className="v-chat__empty v-chat__empty--error">{error}</p> : null}
        {!loading && !error && messages.length === 0 ? (
          <p className="v-chat__empty">
            No messages yet. Use this to share anything easier to write than say —
            a medicine name, a dosage, a spelling.
          </p>
        ) : null}

        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`v-msg ${mine ? 'is-mine' : 'is-theirs'}`}>
              {!mine ? <span className="v-msg__who">{m.senderName}</span> : null}
              <p className="v-msg__text">{m.text}</p>
              <span className="v-msg__time">{timeOf(m)}</span>
            </div>
          );
        })}
      </div>

      <form className="v-chat__composer" onSubmit={submit}>
        {sendError ? <p className="v-chat__senderr">{sendError}</p> : null}
        <textarea
          className="v-chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder="Write a message…"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message"
        />
        <button
          type="submit"
          className="v-chat__send"
          disabled={sending || draft.trim().length === 0}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </aside>
  );
}
