import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { sendMessage, type Sender } from '../../services/messageService';
import type { Consultation } from '../../types/consultation';
import type {
  AppointmentMeta,
  ConsultationLinkMeta,
  MessageType,
  PrescriptionMeta,
} from '../../types/messaging';

// ============================================================================
// MedicalActions — doctor-only composer affordance for sending structured
// clinical messages (Stage 2). Each action either sends immediately or opens a
// small inline form. Payloads are embedded in the message `meta` so the card is
// self-contained (no dependency on a separate viewer). No file uploads here —
// image/PDF/voice attachments remain deferred.
// ============================================================================

type ActionId =
  | 'menu'
  | 'prescription'
  | 'certificate'
  | 'lab_request'
  | 'appointment'
  | 'follow_up'
  | 'consultation_link'
  | null;

const MENU: { id: Exclude<ActionId, null | 'menu'>; icon: string; label: string }[] = [
  { id: 'prescription', icon: '📄', label: 'Prescription' },
  { id: 'certificate', icon: '📑', label: 'Medical certificate' },
  { id: 'lab_request', icon: '🧪', label: 'Lab request' },
  { id: 'appointment', icon: '📅', label: 'Appointment reminder' },
  { id: 'follow_up', icon: '🔁', label: 'Follow-up reminder' },
  { id: 'consultation_link', icon: '🎥', label: 'Video consultation link' },
];

export function MedicalActions({
  conversationId,
  consultationId,
  sender,
}: {
  conversationId: string;
  consultationId: string;
  sender: Sender;
}) {
  const [action, setAction] = useState<ActionId>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAction(null);
    setError(null);
  };

  const send = async (type: MessageType, text: string, meta: Record<string, unknown>) => {
    setSending(true);
    setError(null);
    try {
      await sendMessage(conversationId, sender, { type, text, meta });
      close();
    } catch (err) {
      console.error('[medical] send failed', err);
      setError('Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendPrescription = async () => {
    setSending(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'consultations', consultationId));
      const c = snap.exists() ? ({ id: snap.id, ...snap.data() } as Consultation) : null;
      const rx = c?.clinical?.prescription;
      if (!rx || rx.medications.length === 0) {
        setError('No prescription on this consultation yet. Publish one first.');
        setSending(false);
        return;
      }
      const meta: PrescriptionMeta = {
        consultationId,
        medications: rx.medications,
        advice: rx.advice ?? '',
      };
      const text = rx.medications.map((m) => `${m.name} — ${m.dose}, ${m.frequency}`).join('\n');
      await send('prescription', text, meta as unknown as Record<string, unknown>);
    } catch (err) {
      console.error('[medical] prescription failed', err);
      setError('Could not load the prescription.');
      setSending(false);
    }
  };

  return (
    <div className="m-actions">
      <button
        type="button"
        className="m-actions__trigger"
        aria-label="Send a clinical document"
        aria-expanded={action !== null}
        onClick={() => setAction((a) => (a === null ? 'menu' : null))}
      >
        ＋
      </button>

      {action === 'menu' ? (
        <div className="m-actions__menu" role="menu">
          {MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="m-actions__item"
              onClick={() => (item.id === 'prescription' ? void sendPrescription() : setAction(item.id))}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {action === 'certificate' ? (
        <TextForm
          title="Medical certificate"
          placeholder="e.g. Fit to return to work from 30 Jul 2026. Diagnosis: viral fever."
          submitLabel="Send certificate"
          sending={sending}
          error={error}
          onCancel={close}
          onSubmit={(text) => void send('certificate', text, {})}
        />
      ) : null}

      {action === 'lab_request' ? (
        <TextForm
          title="Lab request"
          placeholder="e.g. CBC, Fasting blood sugar, Lipid profile. Please visit any partner lab."
          submitLabel="Send lab request"
          sending={sending}
          error={error}
          onCancel={close}
          onSubmit={(text) => void send('lab_request', text, {})}
        />
      ) : null}

      {action === 'appointment' || action === 'follow_up' ? (
        <AppointmentForm
          followUp={action === 'follow_up'}
          sending={sending}
          error={error}
          onCancel={close}
          onSubmit={(meta, text) =>
            void send('appointment', text, meta as unknown as Record<string, unknown>)
          }
        />
      ) : null}

      {action === 'consultation_link' ? (
        <ConfirmForm
          title="Send video consultation link"
          body="The patient will get a card to join the secure video room for this consultation."
          sending={sending}
          error={error}
          onCancel={close}
          onConfirm={() => {
            const meta: ConsultationLinkMeta = { consultationId };
            void send(
              'consultation_link',
              'Join your video consultation',
              meta as unknown as Record<string, unknown>,
            );
          }}
        />
      ) : null}
    </div>
  );
}

function TextForm({
  title,
  placeholder,
  submitLabel,
  sending,
  error,
  onSubmit,
  onCancel,
}: {
  title: string;
  placeholder: string;
  submitLabel: string;
  sending: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="m-actions__form" role="dialog" aria-label={title}>
      <h3 className="m-actions__title">{title}</h3>
      <textarea
        className="m-actions__input"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {error ? <p className="m-actions__err">{error}</p> : null}
      <div className="m-actions__row">
        <button type="button" className="m-actions__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="m-actions__send"
          disabled={sending || text.trim().length === 0}
          onClick={() => onSubmit(text.trim())}
        >
          {sending ? 'Sending…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function AppointmentForm({
  followUp,
  sending,
  error,
  onSubmit,
  onCancel,
}: {
  followUp: boolean;
  sending: boolean;
  error: string | null;
  onSubmit: (meta: AppointmentMeta, text: string) => void;
  onCancel: () => void;
}) {
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const title = followUp ? 'Follow-up reminder' : 'Appointment reminder';
  return (
    <div className="m-actions__form" role="dialog" aria-label={title}>
      <h3 className="m-actions__title">{title}</h3>
      <label className="m-actions__label">
        Date &amp; time
        <input
          type="datetime-local"
          className="m-actions__input"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          autoFocus
        />
      </label>
      <input
        className="m-actions__input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. bring your reports)"
      />
      {error ? <p className="m-actions__err">{error}</p> : null}
      <div className="m-actions__row">
        <button type="button" className="m-actions__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="m-actions__send"
          disabled={sending || !when}
          onClick={() => {
            const iso = new Date(when).toISOString();
            const label = new Date(when).toLocaleString([], {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });
            onSubmit(
              { at: iso, note: note.trim() || undefined, followUp },
              `${followUp ? 'Follow-up' : 'Appointment'}: ${label}`,
            );
          }}
        >
          {sending ? 'Sending…' : 'Send reminder'}
        </button>
      </div>
    </div>
  );
}

function ConfirmForm({
  title,
  body,
  sending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  sending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="m-actions__form" role="dialog" aria-label={title}>
      <h3 className="m-actions__title">{title}</h3>
      <p className="m-actions__body">{body}</p>
      {error ? <p className="m-actions__err">{error}</p> : null}
      <div className="m-actions__row">
        <button type="button" className="m-actions__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="m-actions__send" disabled={sending} onClick={onConfirm}>
          {sending ? 'Sending…' : 'Send link'}
        </button>
      </div>
    </div>
  );
}
