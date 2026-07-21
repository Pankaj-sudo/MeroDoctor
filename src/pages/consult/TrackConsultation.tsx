import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { subscribeConsultation } from '../../services/consultationService';
import { STATUS_META, STATUS_ORDER, statusIndex } from '../../config/consultationStatus';
import { formatNpr } from '../../config/payment';
import type { Consultation, ConsultationStatus, PaymentStatus } from '../../types/consultation';
import type { Timestamp } from 'firebase/firestore';
import '../../styles/consult.css';

const PAYMENT: Record<PaymentStatus, { label: string; tone: string }> = {
  pending_verification: { label: 'Payment pending verification', tone: 'amber' },
  verified: { label: 'Payment verified', tone: 'green' },
  rejected: { label: 'Payment rejected', tone: 'red' },
};

function fmt(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function TrackSkeleton() {
  return (
    <div className="c-track__wrap">
      <div className="c-glass c-track__head">
        <div style={{ flex: 1 }}>
          <div className="c-skel" style={{ width: 90, height: 12 }} />
          <div className="c-skel" style={{ width: 220, height: 26, marginTop: 12 }} />
          <div className="c-skel" style={{ width: 160, height: 12, marginTop: 12 }} />
        </div>
      </div>
      <ol className="c-timeline">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="c-tl__item is-todo">
            <span className="c-tl__node" />
            <div className="c-tl__body">
              <div className="c-skel" style={{ width: 180, height: 14 }} />
              <div className="c-skel" style={{ width: 120, height: 11, marginTop: 8 }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TrackConsultation() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Consultation | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return subscribeConsultation(
      id,
      (next) => setC(next),
      () => setC(null),
    );
  }, [id]);

  const currentIdx = c ? statusIndex(c.status) : -1;
  const timeOf = (s: ConsultationStatus) =>
    c?.statusHistory.find((e) => e.status === s)?.at ?? null;

  return (
    <main className="c-track">
      <header className="c-top">
        <button type="button" className="c-top__back" onClick={() => navigate('/consultations')}>
          <span aria-hidden="true">←</span> Consultations
        </button>
        <span className="c-top__brand">MERODOCTOR</span>
        <span className="c-top__count" />
      </header>

      {c === undefined ? (
        <TrackSkeleton />
      ) : c === null ? (
        <div className="c-track__wrap">
          <div className="c-empty c-glass">
            <p className="c-empty__title">Consultation not found</p>
            <p className="c-empty__body">This link may be wrong, or the consultation was removed.</p>
            <button type="button" className="c-btn c-btn--primary" onClick={() => navigate('/consultations')}>
              Back to consultations
            </button>
          </div>
        </div>
      ) : (
        <div className="c-track__wrap">
          <div className="c-glass c-track__head">
            <div className="c-track__headmain">
              <div className="c-track__id">#{c.id.slice(0, 8).toUpperCase()}</div>
              <h1 className="c-track__name">{c.patient.fullName || 'Your consultation'}</h1>
              <p className="c-track__reason">
                {c.symptoms.map((s) => s.label).join(' · ') || c.customComplaint || 'General consultation'}
              </p>
            </div>
            <div className="c-track__meta">
              <span className={`c-badge c-badge--${PAYMENT[c.payment.status].tone}`}>
                {PAYMENT[c.payment.status].label}
              </span>
              <span className="c-track__fee">{formatNpr(c.payment.fee)}</span>
            </div>
          </div>

          <ol className="c-timeline">
            {STATUS_ORDER.map((s, i) => {
              const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'todo';
              const at = timeOf(s);
              return (
                <li key={s} className={`c-tl__item is-${state}`}>
                  <span className="c-tl__node">{state === 'done' ? '✓' : ''}</span>
                  <div className="c-tl__body">
                    <div className="c-tl__label">{STATUS_META[s].label}</div>
                    <div className="c-tl__desc">{STATUS_META[s].desc}</div>
                    {at ? <div className="c-tl__time">{fmt(at)}</div> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </main>
  );
}
