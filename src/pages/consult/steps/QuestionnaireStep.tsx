import { questionsForSymptom, type Question } from '../../../config/symptoms';
import { Chips, Field, Segmented, TextArea, TextInput } from '../../../components/consult/fields';
import type { QuestionnaireAnswers, SelectedSymptom } from '../../../types/consultation';

function QuestionControl({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  switch (q.type) {
    case 'select':
      return (
        <Segmented
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      );
    case 'yesno':
      return (
        <Segmented
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          options={[
            { value: 'Yes', label: 'Yes' },
            { value: 'No', label: 'No' },
          ]}
        />
      );
    case 'chips':
      return <Chips value={Array.isArray(value) ? value : []} onChange={onChange} options={q.options ?? []} />;
    case 'textarea':
      return <TextArea value={typeof value === 'string' ? value : ''} onChange={onChange} placeholder={q.placeholder} />;
    case 'number':
      return (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          inputMode="numeric"
          placeholder={q.placeholder}
        />
      );
    default:
      return (
        <TextInput value={typeof value === 'string' ? value : ''} onChange={onChange} placeholder={q.placeholder} />
      );
  }
}

export function QuestionnaireStep({
  symptoms,
  answers,
  onChange,
}: {
  symptoms: SelectedSymptom[];
  answers: QuestionnaireAnswers;
  onChange: (v: QuestionnaireAnswers) => void;
}) {
  if (symptoms.length === 0) {
    return (
      <div className="c-empty">
        <p className="c-empty__title">No follow-up questions yet</p>
        <p className="c-empty__body">
          Pick a symptom in the previous step to see tailored questions — or continue and add
          detail in your own words.
        </p>
      </div>
    );
  }

  return (
    <div className="c-qn">
      {symptoms.map((sym) => {
        const qs = questionsForSymptom(sym);
        return (
          <section key={`${sym.category}:${sym.id}`} className="c-qn__block">
            <h3 className="c-qn__sym">{sym.label}</h3>
            <div className="c-grid">
              {qs.map((q) => (
                <Field
                  key={q.id}
                  label={q.unit ? `${q.label} (${q.unit})` : q.label}
                  full={q.type === 'chips' || q.type === 'textarea'}
                >
                  <QuestionControl
                    q={q}
                    value={answers[q.id]}
                    onChange={(v) => onChange({ ...answers, [q.id]: v })}
                  />
                </Field>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
