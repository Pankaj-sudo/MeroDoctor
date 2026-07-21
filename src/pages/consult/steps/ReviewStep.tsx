import { questionsForSymptom } from '../../../config/symptoms';
import type { ConsultationDraft } from '../../../types/consultation';

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="c-sum__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function answerText(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}

function Section({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (s: number) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="c-sum">
      <header className="c-sum__head">
        <h3>{title}</h3>
        <button type="button" className="c-sum__edit" onClick={() => onEdit(step)}>
          Edit
        </button>
      </header>
      {children}
    </section>
  );
}

export function ReviewStep({
  draft,
  onEdit,
}: {
  draft: ConsultationDraft;
  onEdit: (step: number) => void;
}) {
  const p = draft.patient;

  return (
    <div className="c-review">
      <Section title="Patient information" step={0} onEdit={onEdit}>
        <dl className="c-sum__list">
          <Row label="Name" value={p.fullName} />
          <Row label="Age & gender" value={[p.age && `${p.age} yrs`, p.gender].filter(Boolean).join(' · ')} />
          <Row label="Height / weight" value={[p.heightCm && `${p.heightCm} cm`, p.weightKg && `${p.weightKg} kg`].filter(Boolean).join(' · ')} />
          <Row label="Phone" value={p.phone} />
          <Row label="Email" value={p.email} />
          <Row label="Address" value={p.address} />
        </dl>
      </Section>

      <Section title="Reason for consultation" step={1} onEdit={onEdit}>
        {draft.symptoms.length > 0 ? (
          <div className="c-chips c-chips--static">
            {draft.symptoms.map((s) => (
              <span key={`${s.category}:${s.id}`} className="c-chip is-on">{s.label}</span>
            ))}
          </div>
        ) : null}
        {draft.customComplaint ? <p className="c-sum__note">“{draft.customComplaint}”</p> : null}
        {draft.symptoms.length === 0 && !draft.customComplaint ? (
          <p className="c-sum__empty">No symptoms selected.</p>
        ) : null}
      </Section>

      {draft.symptoms.length > 0 ? (
        <Section title="Your answers" step={2} onEdit={onEdit}>
          {draft.symptoms.map((sym) => {
            const qs = questionsForSymptom(sym).filter((q) => answerText(draft.answers[q.id]));
            if (qs.length === 0) return null;
            return (
              <div key={`${sym.category}:${sym.id}`} className="c-sum__group">
                <div className="c-sum__grouptitle">{sym.label}</div>
                <dl className="c-sum__list">
                  {qs.map((q) => (
                    <Row key={q.id} label={q.label} value={answerText(draft.answers[q.id])} />
                  ))}
                </dl>
              </div>
            );
          })}
        </Section>
      ) : null}

      <Section title="Medical history" step={3} onEdit={onEdit}>
        <dl className="c-sum__list">
          <Row label="Past history" value={draft.history.pastMedical} />
          <Row label="Surgeries" value={draft.history.surgeries} />
          <Row label="Food allergies" value={draft.history.foodAllergies} />
          <Row label="Drug allergies" value={draft.history.drugAllergies} />
          <Row label="Medications" value={draft.history.medications} />
          <Row label="Smoking / alcohol" value={[draft.history.smoking, draft.history.alcohol].filter(Boolean).join(' · ')} />
          <Row label="Notes" value={draft.history.notes} />
        </dl>
      </Section>
    </div>
  );
}
