import { STATUS_META } from '../../config/consultationStatus';
import type { Conversation } from '../../types/messaging';

// ============================================================================
// One row in a conversation list (doctor center + patient panel). Shows the
// peer, last-message preview, relative time, unread badge, and status chip —
// all from the conversation's denormalised `lastMessage`, so rendering a list
// of N conversations costs zero message reads.
// ============================================================================

function relativeTime(ms: number | undefined): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function ConversationListItem({
  conversation,
  viewerUid,
  active,
  showPatientName,
  onSelect,
}: {
  conversation: Conversation;
  viewerUid: string;
  active: boolean;
  /** Doctor view lists patients; patient view lists the doctor. */
  showPatientName: boolean;
  onSelect: () => void;
}) {
  const name = showPatientName ? conversation.patientName : conversation.doctorName;
  const unread = conversation.unread?.[viewerUid] ?? 0;
  const preview = conversation.lastMessage;
  const initials = (name || '·')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <button
      type="button"
      className={`m-conv ${active ? 'is-active' : ''} ${unread > 0 ? 'is-unread' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="m-conv__avatar" aria-hidden="true">
        {initials}
      </span>
      <span className="m-conv__body">
        <span className="m-conv__top">
          <span className="m-conv__name">{name || 'Conversation'}</span>
          <span className="m-conv__time">{relativeTime(preview?.at?.toMillis())}</span>
        </span>
        <span className="m-conv__bottom">
          <span className="m-conv__preview">
            {preview
              ? `${preview.senderId === viewerUid ? 'You: ' : ''}${preview.text}`
              : STATUS_META[conversation.status]?.label ?? 'New conversation'}
          </span>
          {unread > 0 ? <span className="m-conv__badge">{unread > 9 ? '9+' : unread}</span> : null}
        </span>
      </span>
    </button>
  );
}
