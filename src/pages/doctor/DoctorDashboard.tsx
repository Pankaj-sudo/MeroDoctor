import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { subscribeAllConsultations } from '../../services/doctorService';
import { STATUS_META } from '../../config/consultationStatus';
import { formatNpr } from '../../config/payment';
import type { Consultation, ConsultationStatus } from '../../types/consultation';
import '../../styles/consult.css';
import '../../styles/doctor.css';

type Filter = 'all' | 'pending' | 'waiting' | 'active' | 'completed';

const ACTIVE: ConsultationStatus[] = ['doctor_reviewing', 'doctor_contacting', 'in_progress'];
const WAITING: ConsultationStatus[] = ['payment_verified', 'doctor_assigned'];

export function statusTone(c: Consultation): 'amber' | 'green' | 'blue' | 'grey' {
  if (c.payment.status === 'pending_verification') return 'amber';
  if (c.status === 'completed') return 'grey';
  if (ACTIVE.includes(c.status)) return 'blue';
  return 'green';
}

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.26);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* audio unavailable */ }
}

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className={`d-stat c-glass${tone ? ` d-stat--${tone}` : ''}`}>
      <div className="d-stat__label">{label}</div>
      <div className="d-stat__value">{value}</div>
      {sub ? <div className="d-stat__sub">{sub}</div> : null}
    </div>
  );
}

const isToday = (ts?: { toDate(): Date } | null) => {
  if (!ts) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  try {
    return ts.toDate() >= start;
  } catch {
    return false;
  }
};

export function DoctorDashboard() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const [all, setAll] = useState<Consultation[] | undefined>(undefined);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<Consultation | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem('md.muted') === '1');
  const knownIds = useRef<Set<string> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeAllConsultations(
      (list) => {
        if (knownIds.current) {
          const added = list.find((c) => !knownIds.current!.has(c.id));
          if (added) {
            setToast(added);
            if (localStorage.getItem('md.muted') !== '1') playChime();
            window.setTimeout(() => setToast((t) => (t?.id === added.id ? null : t)), 9000);
          }
        }
        knownIds.current = new Set(list.map((c) => c.id));
        setAll(list);
      },
      () => setAll([]),
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && el === searchRef.current) {
        setQ('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stats = useMemo(() => {
    const list = all ?? [];
    return {
      today: list.filter((c) => isToday(c.createdAt)).length,
      pending: list.filter((c) => c.payment.status === 'pending_verification').length,
      waiting: list.filter((c) => WAITING.includes(c.status)).length,
      active: list.filter((c) => ACTIVE.includes(c.status)).length,
      completed: list.filter((c) => c.status === 'completed').length,
      revenue: list
        .filter((c) => c.payment.status === 'verified' && isToday(c.paymentReviewedAt ?? c.createdAt))
        .reduce((s, c) => s + (c.payment.fee || 0), 0),
    };
  }, [all]);

  const rows = useMemo(() => {
    let list = all ?? [];
    if (filter === 'pending') list = list.filter((c) => c.payment.status === 'pending_verification');
    else if (filter === 'waiting') list = list.filter((c) => WAITING.includes(c.status));
    else if (filter === 'active') list = list.filter((c) => ACTIVE.includes(c.status));
    else if (filter === 'completed') list = list.filter((c) => c.status === 'completed');
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (c) =>
          c.patient.fullName.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term) ||
          c.symptoms.some((s) => s.label.toLowerCase().includes(term)),
      );
    }
    return list;
  }, [all, filter, q]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('md.muted', next ? '1' : '0');
  };

  return (
    <main className="d-shell">
      <header className="d-top">
        <div className="d-top__brand">
          MERODOCTOR <span>· Clinician</span>
        </div>
        <div className="d-top__actions">
          <button type="button" className="d-iconbtn" onClick={toggleMute} title={muted ? 'Sound off' : 'Sound on'} aria-label="Toggle sound">
            {muted ? '🔕' : '🔔'}
            {stats.pending > 0 ? <span className="d-badge-count">{stats.pending}</span> : null}
          </button>
          <span className="d-top__who">{profile?.displayName || user?.email}</span>
          <button type="button" className="c-btn c-btn--ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="d-wrap">
        <h1 className="d-h1">Consultation desk</h1>
        <p className="d-lead">Everything that needs your attention, live.</p>

        <div className="d-stats">
          <StatCard label="Today" value={stats.today} sub="new consultations" />
          <StatCard label="Pending payments" value={stats.pending} sub="need verification" tone={stats.pending ? 'amber' : ''} />
          <StatCard label="Waiting" value={stats.waiting} sub="ready for a doctor" />
          <StatCard label="Active" value={stats.active} sub="in progress" tone={stats.active ? 'blue' : ''} />
          <StatCard label="Completed" value={stats.completed} sub="all time" />
          <StatCard label="Revenue today" value={formatNpr(stats.revenue)} sub="verified payments" tone="green" />
        </div>

        <div className="d-toolbar">
          <div className="d-filters">
            {([
              ['all', 'All'],
              ['pending', 'Pending payment'],
              ['waiting', 'Waiting'],
              ['active', 'Active'],
              ['completed', 'Completed'],
            ] as [Filter, string][]).map(([f, label]) => (
              <button key={f} type="button" className={`d-filter${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
          <div className="d-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, ID, symptom…  ( / )"
            />
          </div>
        </div>

        {all === undefined ? (
          <div className="d-queue">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="d-row c-glass">
                <div className="c-skel" style={{ width: '40%', height: 18 }} />
                <div className="c-skel" style={{ width: 100, height: 24 }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="c-empty c-glass">
            <p className="c-empty__title">Nothing here</p>
            <p className="c-empty__body">No consultations match this view yet.</p>
          </div>
        ) : (
          <div className="d-queue">
            {rows.map((c) => (
              <button key={c.id} type="button" className="d-row c-glass" onClick={() => navigate(`/doctor/consultation/${c.id}`)}>
                <div className="d-row__main">
                  <div className="d-row__name">
                    {c.patient.fullName || 'Unnamed patient'}
                    <span className="d-row__id">#{c.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="d-row__reason">
                    {c.symptoms.map((s) => s.label).join(', ') || c.customComplaint || 'General consultation'}
                  </div>
                </div>
                <div className="d-row__meta">
                  {c.payment.status === 'pending_verification' ? (
                    <span className="c-badge c-badge--amber">Payment to verify</span>
                  ) : (
                    <span className={`c-badge c-badge--${statusTone(c)}`}>{STATUS_META[c.status].label}</span>
                  )}
                  <span className="d-row__go" aria-hidden="true">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {toast ? (
        <div className="d-toast c-glass" role="status">
          <div className="d-toast__dot" />
          <div className="d-toast__body">
            <div className="d-toast__title">New consultation</div>
            <div className="d-toast__text">
              {toast.patient.fullName} · {toast.symptoms.map((s) => s.label).join(', ') || 'General'}
            </div>
          </div>
          <button type="button" className="c-btn c-btn--primary d-toast__btn" onClick={() => { navigate(`/doctor/consultation/${toast.id}`); setToast(null); }}>
            Open
          </button>
          <button type="button" className="d-toast__x" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      ) : null}
    </main>
  );
}
