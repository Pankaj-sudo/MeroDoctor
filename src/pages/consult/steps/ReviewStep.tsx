import { questionsForSymptom } from '../../../config/symptoms';
import { summarizeHistory } from '../../../config/medicalHistory';
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
  return (
    <div className="c-review">
      <Section title="Reason for consultation" step={0} onEdit={onEdit}>
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
        <Section title="Your answers" step={1} onEdit={onEdit}>
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

      <Section title="Medical history" step={2} onEdit={onEdit}>
        <dl className="c-sum__list">
          {summarizeHistory(draft.history).map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </dl>
        {summarizeHistory(draft.history).length === 0 ? (
          <p className="c-sum__empty">Nothing added.</p>
        ) : null}
      </Section>
    </div>
  );
}
