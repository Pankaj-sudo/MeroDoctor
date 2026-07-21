import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { CONSULTATION_FEE, formatNpr } from '../../config/payment';
import { createConsultation, uploadPaymentScreenshot } from '../../services/consultationService';
import { emptyDraft, type ConsultationDraft, type PaymentInfo } from '../../types/consultation';
import { PatientInfoStep } from './steps/PatientInfoStep';
import { SymptomsStep } from './steps/SymptomsStep';
import { QuestionnaireStep } from './steps/QuestionnaireStep';
import { MedicalHistoryStep } from './steps/MedicalHistoryStep';
import { ReviewStep } from './steps/ReviewStep';
import { PaymentStep } from './steps/PaymentStep';
import '../../styles/consult.css';

const STEPS = [
  { key: 'Details', title: 'Your details', subtitle: 'Who is this consultation for?' },
  { key: 'Reason', title: 'What brings you in?', subtitle: 'Choose the areas that match how you feel.' },
  { key: 'Questions', title: 'A few quick questions', subtitle: 'Tailored to what you selected.' },
  { key: 'History', title: 'Medical history', subtitle: 'This helps your doctor keep you safe.' },
  { key: 'Review', title: 'Review your consultation', subtitle: 'Check everything, then pay.' },
  { key: 'Payment', title: 'eSewa payment', subtitle: 'Scan, pay, and upload your screenshot.' },
];

function stepValid(step: number, draft: ConsultationDraft, screenshot: File | null): boolean {
  switch (step) {
    case 0:
      return Boolean(
        draft.patient.fullName.trim() &&
          (draft.patient.age || draft.patient.dob) &&
          draft.patient.gender &&
          draft.patient.phone.trim(),
      );
    case 1:
      return draft.symptoms.length > 0 || draft.customComplaint.trim().length > 0;
    case 5:
      return Boolean(screenshot);
    default:
      return true;
  }
}

export function ConsultWizard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ConsultationDraft>(() =>
    emptyDraft(profile?.email ?? user?.email ?? '', profile?.displayName ?? user?.displayName ?? ''),
  );
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const last = STEPS.length - 1;
  const meta = STEPS[step];
  const canProceed = stepValid(step, draft, screenshot);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  function back() {
    if (step > 0) setStep((s) => s - 1);
    else navigate('/dashboard');
  }

  async function submit() {
    if (!user || !screenshot) return;
    setSubmitting(true);
    setError('');
    try {
      const screenshotUrl = await uploadPaymentScreenshot(user.uid, screenshot);
      const payment: PaymentInfo = {
        method: 'esewa',
        fee: CONSULTATION_FEE,
        status: 'pending_verification',
        screenshotUrl,
        reference: '',
      };
      const id = await createConsultation(user.uid, draft, payment);
      navigate(`/consult/success/${id}`, { replace: true });
    } catch (err) {
      console.error('[consult] submit failed', err);
      setError('We couldn’t submit your consultation. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="c-shell">
      <header className="c-top">
        <button type="button" className="c-top__back" onClick={back} disabled={submitting}>
          <span aria-hidden="true">←</span> {step === 0 ? 'Dashboard' : 'Back'}
        </button>
        <span className="c-top__brand">MERODOCTOR</span>
        <span className="c-top__count">
          {step + 1} <em>/ {STEPS.length}</em>
        </span>
      </header>

      <div className="c-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <nav className="c-stepper" aria-label="Consultation steps">
        {STEPS.map((m, i) => (
          <button
            key={m.key}
            type="button"
            className={`c-stepper__item${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}`}
            disabled={i > step}
            onClick={() => i <= step && setStep(i)}
          >
            <span className="c-stepper__dot">{i < step ? '✓' : i + 1}</span>
            <span className="c-stepper__label">{m.key}</span>
          </button>
        ))}
      </nav>

      <section className="c-glass c-panel">
        <div className="c-panel__head">
          <h1 className="c-panel__title">{meta.title}</h1>
          <p className="c-panel__sub">{meta.subtitle}</p>
        </div>
        <div className="c-step-anim" key={step}>
          {step === 0 && (
            <PatientInfoStep value={draft.patient} onChange={(patient) => setDraft({ ...draft, patient })} />
          )}
          {step === 1 && (
            <SymptomsStep
              symptoms={draft.symptoms}
              customComplaint={draft.customComplaint}
              onSymptoms={(symptoms) => setDraft({ ...draft, symptoms })}
              onCustom={(customComplaint) => setDraft({ ...draft, customComplaint })}
            />
          )}
          {step === 2 && (
            <QuestionnaireStep
              symptoms={draft.symptoms}
              answers={draft.answers}
              onChange={(answers) => setDraft({ ...draft, answers })}
            />
          )}
          {step === 3 && (
            <MedicalHistoryStep value={draft.history} onChange={(history) => setDraft({ ...draft, history })} />
          )}
          {step === 4 && <ReviewStep draft={draft} onEdit={(s) => setStep(s)} />}
          {step === 5 && <PaymentStep screenshot={screenshot} onScreenshot={setScreenshot} />}
        </div>
      </section>

      {error ? <p className="c-error" role="alert">{error}</p> : null}

      <footer className="c-actions">
        <button type="button" className="c-btn c-btn--ghost" onClick={back} disabled={submitting}>
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < last ? (
          <button
            type="button"
            className="c-btn c-btn--primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="c-btn c-btn--primary"
            onClick={submit}
            disabled={!canProceed || submitting}
          >
            {submitting ? 'Submitting…' : `Submit — ${formatNpr(CONSULTATION_FEE)}`}
          </button>
        )}
      </footer>
    </main>
  );
}
