import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { subscribeConsultation } from '../../services/consultationService';
import {
  advanceStatus,
  assignToMe,
  markCompleted,
  publishPrescription,
  rejectPayment,
  requestNewScreenshot,
  saveClinical,
  subscribeActivity,
  verifyPayment,
  type Actor,
} from '../../services/doctorService';
import { questionsForSymptom } from '../../config/symptoms';
import { summarizeHistory } from '../../config/medicalHistory';
import { STATUS_META } from '../../config/consultationStatus';
import { formatNpr } from '../../config/payment';
import { Field, TextArea, TextInput } from '../../components/consult/fields';
import { emptyClinical } from '../../types/consultation';
import type { ActivityLog, Clinical, Consultation } from '../../types/consultation';
import type { Timestamp } from 'firebase/firestore';
import '../../styles/consult.css';
import '../../styles/doctor.css';

function fmt(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="c-sum__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ConsultationDetail() {
  const { id = '' } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState<Consultation | null | undefined>(undefined);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [clinical, setClinical] = useState<Clinical>(emptyClinical());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const hydrated = useRef(false);

  const actor: Actor = { uid: user?.uid ?? '', name: profile?.displayName ?? user?.email ?? 'Doctor' };

  useEffect(() => {
    if (!id) return;
    return subscribeConsultation(
      id,
      (next) => {
        setC(next);
        if (next && !hydrated.current) {
          setClinical(next.clinical ?? emptyClinical());
          hydrated.current = true;
        }
      },
      () => setC(null),
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeActivity(id, setLogs);
  }, [id]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      console.error('[doctor] action failed', err);
      window.alert('That action failed. Please try again.');
    } finally {
      setBusy('');
    }
  }

  const setCl =
    (k: keyof Clinical) =>
    (v: string) =>
      setClinical((cl) => ({ ...cl, [k]: v }));

  const addMed = () =>
    setClinical((cl) => ({
      ...cl,
      prescription: {
        ...cl.prescription,
        medications: [...cl.prescription.medications, { name: '', dose: '', frequency: '', duration: '' }],
      },
    }));
  const updateMed = (i: number, patch: Partial<{ name: string; dose: string; frequency: string; duration: string }>) =>
    setClinical((cl) => ({
      ...cl,
      prescription: {
        ...cl.prescription,
        medications: cl.prescription.medications.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
      },
    }));
  const removeMed = (i: number) =>
    setClinical((cl) => ({
      ...cl,
      prescription: { ...cl.prescription, medications: cl.prescription.medications.filter((_, idx) => idx !== i) },
    }));

  if (c === undefined) return <div className="d-shell"><div className="d-wrap"><div className="c-skel" style={{ height: 40, width: 260 }} /></div></div>;
  if (c === null)
    return (
      <div className="d-shell">
        <div className="d-wrap">
          <div className="c-empty c-glass">
            <p className="c-empty__title">Consultation not found</p>
            <button type="button" className="c-btn c-btn--primary" onClick={() => navigate('/doctor')}>Back to desk</button>
          </div>
        </div>
      </div>
    );

  const p = c.patient;
  const paid = c.payment.status;
  const assigned = Boolean(c.assignedDoctorId);
  const done = c.status === 'completed';

  return (
    <main className="d-shell">
      <header className="d-top">
        <button type="button" className="c-top__back" onClick={() => navigate('/doctor')}>
          <span aria-hidden="true">←</span> Desk
        </button>
        <div className="d-top__brand">MERODOCTOR <span>· Record</span></div>
        <span className={`c-badge c-badge--${paid === 'pending_verification' ? 'amber' : done ? 'grey' : 'green'}`}>
          {STATUS_META[c.status].label}
        </span>
      </header>

      <div className="d-detail">
        <div className="d-detail__head">
          <div>
            <div className="d-row__id">#{c.id.slice(0, 8).toUpperCase()} · submitted {fmt(c.createdAt)}</div>
            <h1 className="d-h1">{p.fullName || 'Unnamed patient'}</h1>
            <p className="d-lead">
              {[p.age && `${p.age} yrs`, p.gender, c.priority === 'urgent' && 'Urgent'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="d-detail__headbtns">
            <button type="button" className="c-btn c-btn--ghost" onClick={() => window.open(`/app/doctor/consultation/${c.id}/print`, '_blank')}>
              Print / PDF
            </button>
          </div>
        </div>

        <div className="d-cols">
          {/* -------- MAIN -------- */}
          <div className="d-main">
            <section className="c-glass d-card">
              <h3 className="d-card__title">Patient information</h3>
              <dl className="c-sum__list">
                <Row label="Height / weight" value={[p.heightCm && `${p.heightCm} cm`, p.weightKg && `${p.weightKg} kg`].filter(Boolean).join(' · ')} />
                <Row label="Phone" value={p.phone} />
                <Row label="Email" value={p.email} />
                <Row label="Address" value={p.address} />
              </dl>
            </section>

            <section className="c-glass d-card">
              <h3 className="d-card__title">Chief complaint & symptoms</h3>
              {c.symptoms.length > 0 ? (
                <div className="c-chips c-chips--static">
                  {c.symptoms.map((s) => <span key={`${s.category}:${s.id}`} className="c-chip is-on">{s.label}</span>)}
                </div>
              ) : null}
              {c.customComplaint ? <p className="c-sum__note">“{c.customComplaint}”</p> : null}
              {c.symptoms.map((sym) => {
                const qs = questionsForSymptom(sym).filter((q) => {
                  const a = c.answers[q.id];
                  return Array.isArray(a) ? a.length : a;
                });
                if (!qs.length) return null;
                return (
                  <div key={`${sym.category}:${sym.id}`} className="c-sum__group">
                    <div className="c-sum__grouptitle">{sym.label}</div>
                    <dl className="c-sum__list">
                      {qs.map((q) => {
                        const a = c.answers[q.id];
                        return <Row key={q.id} label={q.label} value={Array.isArray(a) ? a.join(', ') : a} />;
                      })}
                    </dl>
                  </div>
                );
              })}
            </section>

            <section className="c-glass d-card">
              <h3 className="d-card__title">Medical history</h3>
              <dl className="c-sum__list">
                {summarizeHistory(c.history).map((r) => (
                  <Row key={r.label} label={r.label} value={r.value} />
                ))}
              </dl>
              {summarizeHistory(c.history).length === 0 ? (
                <p className="c-sum__empty">No history provided.</p>
              ) : null}
            </section>

            {/* ---- clinical documentation ---- */}
            <section className="c-glass d-card">
              <h3 className="d-card__title">Clinical documentation</h3>
              <div className="c-grid">
                <Field label="SOAP — Subjective" full><TextArea value={clinical.soapSubjective} onChange={setCl('soapSubjective')} placeholder="History as reported" /></Field>
                <Field label="SOAP — Objective" full><TextArea value={clinical.soapObjective} onChange={setCl('soapObjective')} placeholder="Exam findings, vitals" /></Field>
                <Field label="SOAP — Assessment" full><TextArea value={clinical.soapAssessment} onChange={setCl('soapAssessment')} placeholder="Clinical impression" /></Field>
                <Field label="SOAP — Plan" full><TextArea value={clinical.soapPlan} onChange={setCl('soapPlan')} placeholder="Management plan" /></Field>
                <Field label="Diagnosis"><TextInput value={clinical.diagnosis} onChange={setCl('diagnosis')} placeholder="Primary diagnosis" /></Field>
                <Field label="Differential diagnosis"><TextInput value={clinical.differential} onChange={setCl('differential')} placeholder="Comma-separated" /></Field>
                <Field label="Investigations to order" full><TextArea value={clinical.investigations} onChange={setCl('investigations')} rows={2} placeholder="Labs, imaging…" /></Field>
                <Field label="Treatment plan" full><TextArea value={clinical.treatmentPlan} onChange={setCl('treatmentPlan')} rows={2} /></Field>
              </div>

              <div className="d-rx">
                <div className="d-rx__head">
                  <span>Prescription</span>
                  <button type="button" className="c-btn c-btn--ghost d-rx__add" onClick={addMed}>+ Add medication</button>
                </div>
                {clinical.prescription.medications.length === 0 ? (
                  <p className="c-sum__empty">No medications added yet.</p>
                ) : (
                  clinical.prescription.medications.map((m, i) => (
                    <div key={i} className="d-rx__row">
                      <input className="c-input" placeholder="Medicine" value={m.name} onChange={(e) => updateMed(i, { name: e.target.value })} />
                      <input className="c-input" placeholder="Dose" value={m.dose} onChange={(e) => updateMed(i, { dose: e.target.value })} />
                      <input className="c-input" placeholder="Frequency" value={m.frequency} onChange={(e) => updateMed(i, { frequency: e.target.value })} />
                      <input className="c-input" placeholder="Duration" value={m.duration} onChange={(e) => updateMed(i, { duration: e.target.value })} />
                      <button type="button" className="d-rx__del" onClick={() => removeMed(i)} aria-label="Remove">×</button>
                    </div>
                  ))
                )}
                <div className="c-grid" style={{ marginTop: 14 }}>
                  <Field label="Advice" full><TextArea value={clinical.prescription.advice} onChange={(v) => setClinical((cl) => ({ ...cl, prescription: { ...cl.prescription, advice: v } }))} rows={2} /></Field>
                  <Field label="Follow-up date"><TextInput type="date" value={clinical.followUpDate} onChange={setCl('followUpDate')} /></Field>
                  <Field label="Instructions to patient" full><TextArea value={clinical.patientInstructions} onChange={setCl('patientInstructions')} rows={2} /></Field>
                </div>
              </div>

              <div className="d-card__actions">
                <button type="button" className="c-btn c-btn--ghost" disabled={busy !== ''} onClick={() => run('save', () => saveClinical(id, actor, clinical))}>
                  {busy === 'save' ? 'Saving…' : 'Save notes'}
                </button>
                <button type="button" className="c-btn c-btn--primary" disabled={busy !== ''} onClick={() => run('publish', () => publishPrescription(id, actor, clinical))}>
                  {busy === 'publish' ? 'Publishing…' : 'Publish prescription'}
                </button>
              </div>
            </section>
          </div>

          {/* -------- SIDEBAR -------- */}
          <aside className="d-side">
            <section className="c-glass d-card">
              <h3 className="d-card__title">Payment</h3>
              <div className="d-pay">
                <span className={`c-badge c-badge--${paid === 'verified' ? 'green' : paid === 'rejected' ? 'red' : 'amber'}`}>
                  {paid === 'verified' ? 'Verified' : paid === 'rejected' ? 'Rejected' : 'Pending verification'}
                </span>
                <span className="d-pay__fee">{formatNpr(c.payment.fee)}</span>
              </div>
              {c.payment.screenshotUrl ? (
                <a className="d-pay__shot" href={c.payment.screenshotUrl} target="_blank" rel="noreferrer">
                  <img src={c.payment.screenshotUrl} alt="Payment screenshot" />
                </a>
              ) : (
                <p className="c-sum__empty">No screenshot uploaded.</p>
              )}
              {paid !== 'verified' ? (
                <>
                  <textarea className="c-input c-textarea" rows={2} placeholder="Note to patient (for reject / re-upload)" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 12 }} />
                  <div className="d-card__actions">
                    <button type="button" className="c-btn c-btn--primary" disabled={busy !== ''} onClick={() => run('verify', () => verifyPayment(id, actor))}>
                      {busy === 'verify' ? '…' : 'Verify'}
                    </button>
                    <button type="button" className="c-btn c-btn--ghost" disabled={busy !== ''} onClick={() => run('reqshot', () => requestNewScreenshot(id, actor, note))}>
                      Request new
                    </button>
                    <button type="button" className="c-btn c-btn--ghost" disabled={busy !== ''} onClick={() => run('reject', () => rejectPayment(id, actor, note))}>
                      Reject
                    </button>
                  </div>
                </>
              ) : null}
            </section>

            <section className="c-glass d-card">
              <h3 className="d-card__title">Workflow</h3>
              <div className="d-flow">
                {!assigned ? (
                  <button type="button" className="c-btn c-btn--primary" disabled={busy !== '' || paid !== 'verified'} onClick={() => run('assign', () => assignToMe(id, actor))}>
                    {paid !== 'verified' ? 'Verify payment first' : 'Assign to me'}
                  </button>
                ) : (
                  <p className="d-flow__assigned">Assigned to <strong>{c.assignedDoctorName}</strong></p>
                )}
                {assigned && !done ? (
                  <>
                    <button type="button" className="c-btn c-btn--ghost" disabled={busy !== ''} onClick={() => run('review', () => advanceStatus(id, actor, 'doctor_reviewing', 'Started reviewing'))}>Mark reviewing</button>
                    <button type="button" className="c-btn c-btn--ghost" disabled={busy !== ''} onClick={() => run('contact', () => advanceStatus(id, actor, 'doctor_contacting', 'Contacting patient'))}>Contacting patient</button>
                    <button type="button" className="c-btn c-btn--ghost" disabled={busy !== ''} onClick={() => run('progress', () => advanceStatus(id, actor, 'in_progress', 'Consultation in progress'))}>Start consultation</button>
                    <button type="button" className="c-btn c-btn--primary" disabled={busy !== ''} onClick={() => run('complete', () => markCompleted(id, actor))}>Mark completed</button>
                  </>
                ) : null}
                {done ? <p className="d-flow__assigned">This consultation is complete.</p> : null}
              </div>
            </section>

            <section className="c-glass d-card">
              <h3 className="d-card__title">Activity log</h3>
              {logs.length === 0 ? (
                <p className="c-sum__empty">No activity yet.</p>
              ) : (
                <ul className="d-audit">
                  {logs.map((l) => (
                    <li key={l.id}>
                      <span className="d-audit__act">{l.action}</span>
                      <span className="d-audit__meta">{l.actorName} · {fmt(l.at)}</span>
                      {l.detail ? <span className="d-audit__detail">{l.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
