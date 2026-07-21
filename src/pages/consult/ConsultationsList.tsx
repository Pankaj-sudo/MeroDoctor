import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { subscribePatientConsultations } from '../../services/consultationService';
import { STATUS_META } from '../../config/consultationStatus';
import { formatNpr } from '../../config/payment';
import type { Consultation, PaymentStatus } from '../../types/consultation';
import type { Timestamp } from 'firebase/firestore';
import '../../styles/consult.css';

const PAY_TONE: Record<PaymentStatus, string> = {
  pending_verification: 'amber',
  verified: 'green',
  rejected: 'red',
};

function fmtDate(ts: Timestamp | null): string {
  if (!ts) return 'Just now';
  try {
    return ts.toDate().toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '';
  }
}

function ListSkeleton() {
  return (
    <div className="c-list__grid">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="c-glass c-ccard">
          <div className="c-skel" style={{ width: 100, height: 12 }} />
          <div className="c-skel" style={{ width: '80%', height: 18, marginTop: 16 }} />
          <div className="c-skel" style={{ width: '55%', height: 12, marginTop: 20 }} />
        </div>
      ))}
    </div>
  );
}

export function ConsultationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Consultation[] | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    return subscribePatientConsultations(
      user.uid,
      (next) => setList(next),
      () => setList([]),
    );
  }, [user]);

  return (
    <main className="c-list">
      <header className="c-top">
        <button type="button" className="c-top__back" onClick={() => navigate('/dashboard')}>
          <span aria-hidden="true">←</span> Home
        </button>
        <span className="c-top__brand">MERODOCTOR</span>
        <span className="c-top__count" />
      </header>

      <div className="c-list__wrap">
        <div className="c-list__head">
          <div>
            <h1 className="c-list__title">Your consultations</h1>
            <p className="c-list__sub">Follow status in real time, or start a new one.</p>
          </div>
          <button type="button" className="c-btn c-btn--primary" onClick={() => navigate('/consult')}>
            New consultation
          </button>
        </div>

        {list === undefined ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <div className="c-empty c-glass">
            <p className="c-empty__title">No consultations yet</p>
            <p className="c-empty__body">Start your first consultation — it takes about two minutes.</p>
            <button type="button" className="c-btn c-btn--primary" onClick={() => navigate('/consult')}>
              Start a consultation
            </button>
          </div>
        ) : (
          <div className="c-list__grid">
            {list.map((c) => (
              <button key={c.id} type="button" className="c-glass c-ccard" onClick={() => navigate(`/track/${c.id}`)}>
                <div className="c-ccard__top">
                  <span className="c-ccard__id">#{c.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`c-badge c-badge--${PAY_TONE[c.payment.status]}`}>
                    {STATUS_META[c.status].label}
                  </span>
                </div>
                <div className="c-ccard__reason">
                  {c.symptoms.map((s) => s.label).join(', ') || c.customComplaint || 'General consultation'}
                </div>
                <div className="c-ccard__foot">
                  <span>{fmtDate(c.createdAt)}</span>
                  <span>{formatNpr(c.payment.fee)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
