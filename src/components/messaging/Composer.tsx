import { useRef, useState } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../config/messaging';

// A small, dependency-free emoji strip. A full picker is Stage 2; this keeps the
// "emoji support" affordance without shipping a heavy library.
const QUICK_EMOJI = ['🙂', '👍', '🙏', '❤️', '😊', '😟', '🤒', '💊', '📋', '✅'];

/**
 * Message composer: multi-line input (Enter sends, Shift+Enter newlines), a
 * quick-emoji strip, typing notification, and a disabled/locked state when the
 * follow-up window has ended.
 */
export function Composer({
  disabled,
  sending,
  onSend,
  onTyping,
  placeholder = 'Write a message…',
  leading,
}: {
  disabled: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  onTyping: () => void;
  placeholder?: string;
  /** Optional control rendered at the start of the row (e.g. medical actions). */
  leading?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  if (disabled) return null;

  return (
    <div className="m-composer">
      {emojiOpen ? (
        <div className="m-emoji" role="listbox" aria-label="Quick emoji">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="m-emoji__btn"
              onClick={() => {
                setText((t) => (t + e).slice(0, MAX_MESSAGE_LENGTH));
                inputRef.current?.focus();
              }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}

      <div className="m-composer__row">
        {leading}
        <button
          type="button"
          className="m-composer__emoji"
          aria-label="Emoji"
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen((o) => !o)}
        >
          🙂
        </button>
        <textarea
          ref={inputRef}
          className="m-composer__input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message"
        />
        <button
          type="button"
          className="m-composer__send"
          onClick={submit}
          disabled={sending || text.trim().length === 0}
          aria-label="Send message"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  );
}
