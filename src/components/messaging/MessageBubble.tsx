import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMessageTime } from '../../lib/conversationState';
import type {
  AppointmentMeta,
  ConsultationLinkMeta,
  Message,
  PrescriptionMeta,
} from '../../types/messaging';

// ============================================================================
// One message row. Text + system render as bubbles; structured (medical)
// messages render as rich cards with an appropriate action. Payloads come from
// `message.meta`, embedded at send time, so a card is self-contained.
// ============================================================================

export function MessageBubble({
  message,
  mine,
  endsGroup,
  peerRead,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  endsGroup: boolean;
  peerRead: boolean;
  onDelete?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const at = message.createdAt?.toDate() ?? null;

  if (message.type === 'system') {
    return (
      <div className="m-system" role="note">
        <span>{message.text}</span>
      </div>
    );
  }

  const meta = (message.meta ?? {}) as Record<string, unknown>;
  const isCard = message.type !== 'text';

  const copy = () => {
    void navigator.clipboard?.writeText(message.text).catch(() => {});
    setMenuOpen(false);
  };

  return (
    <div className={`m-row ${mine ? 'is-mine' : 'is-theirs'}`}>
      <div
        className={`m-bubble ${isCard ? 'm-bubble--card' : ''}`}
        onDoubleClick={() => !isCard && setMenuOpen((o) => !o)}
      >
        {message.deleted ? (
          <p className="m-bubble__text m-bubble__text--deleted">Message deleted</p>
        ) : isCard ? (
          renderCard(message, meta, navigate)
        ) : (
          <p className="m-bubble__text">{message.text}</p>
        )}

        {endsGroup ? (
          <span className="m-bubble__meta">
            <span className="m-bubble__time">{formatMessageTime(at)}</span>
            {mine && !message.deleted ? (
              <span
                className={`m-receipt ${peerRead ? 'is-read' : 'is-delivered'}`}
                title={peerRead ? 'Read' : 'Delivered'}
                aria-label={peerRead ? 'Read' : 'Delivered'}
              >
                {peerRead ? '✓✓' : '✓'}
              </span>
            ) : null}
          </span>
        ) : null}

        {menuOpen && !message.deleted && !isCard ? (
          <div className="m-menu" role="menu">
            <button type="button" role="menuitem" onClick={copy}>
              Copy
            </button>
            {mine && onDelete ? (
              <button
                type="button"
                role="menuitem"
                className="m-menu__danger"
                onClick={() => {
                  onDelete(message.id);
                  setMenuOpen(false);
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderCard(
  message: Message,
  meta: Record<string, unknown>,
  navigate: ReturnType<typeof useNavigate>,
): React.ReactNode {
  switch (message.type) {
    case 'prescription': {
      const rx = meta as unknown as PrescriptionMeta;
      const meds = Array.isArray(rx.medications) ? rx.medications : [];
      return (
        <div className="m-card">
          <div className="m-card__head">
            <span className="m-card__icon">📄</span>
            <span className="m-card__title">Prescription</span>
          </div>
          <ul className="m-card__meds">
            {meds.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong>
                <span>
                  {[m.dose, m.frequency, m.duration].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          {rx.advice ? <p className="m-card__note">{rx.advice}</p> : null}
        </div>
      );
    }
    case 'certificate':
      return (
        <div className="m-card">
          <div className="m-card__head">
            <span className="m-card__icon">📑</span>
            <span className="m-card__title">Medical certificate</span>
          </div>
          <p className="m-card__note">{message.text}</p>
        </div>
      );
    case 'lab_request':
      return (
        <div className="m-card">
          <div className="m-card__head">
            <span className="m-card__icon">🧪</span>
            <span className="m-card__title">Lab request</span>
          </div>
          <p className="m-card__note">{message.text}</p>
        </div>
      );
    case 'appointment': {
      const appt = meta as unknown as AppointmentMeta;
      const when = appt.at ? new Date(appt.at) : null;
      return (
        <div className="m-card">
          <div className="m-card__head">
            <span className="m-card__icon">{appt.followUp ? '🔁' : '📅'}</span>
            <span className="m-card__title">
              {appt.followUp ? 'Follow-up reminder' : 'Appointment'}
            </span>
          </div>
          {when ? (
            <p className="m-card__when">
              {when.toLocaleString([], {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
          {appt.note ? <p className="m-card__note">{appt.note}</p> : null}
        </div>
      );
    }
    case 'consultation_link': {
      const link = meta as unknown as ConsultationLinkMeta;
      return (
        <div className="m-card">
          <div className="m-card__head">
            <span className="m-card__icon">🎥</span>
            <span className="m-card__title">Video consultation</span>
          </div>
          <p className="m-card__note">{message.text}</p>
          {link.consultationId ? (
            <button
              type="button"
              className="m-card__action"
              onClick={() => navigate(`/consultation/${link.consultationId}/room`)}
            >
              Join call
            </button>
          ) : null}
        </div>
      );
    }
    default:
      // Future types (image/pdf/voice) not yet sendable — show a labelled stub.
      return (
        <div className="m-card">
          <div className="m-card__head">
            <span className="m-card__icon">📎</span>
            <span className="m-card__title">{message.type}</span>
          </div>
          <p className="m-card__note">{message.text}</p>
        </div>
      );
  }
}
