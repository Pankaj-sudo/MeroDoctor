import { useState, type ReactNode } from 'react';
import { SYMPTOM_CATEGORIES } from '../../../config/symptoms';
import { TextArea } from '../../../components/consult/fields';
import type { SelectedSymptom, SymptomCategoryId } from '../../../types/consultation';

const S = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICON: Record<SymptomCategoryId, ReactNode> = {
  respiratory: S('M12 3v8M8 11c-2 0-3 1.5-3 4s1 4 3 4 2.5-2 2.5-4V11H8zM16 11c2 0 3 1.5 3 4s-1 4-3 4-2.5-2-2.5-4V11H16z'),
  cardiovascular: S('M12 20C7 16 4 13 4 9.3 4 6.9 5.9 5 8.2 5c1.6 0 3 .9 3.8 2.3C12.8 5.9 14.2 5 15.8 5 18.1 5 20 6.9 20 9.3 20 13 17 16 12 20z'),
  gastrointestinal: S('M15 4c-1 3-1 5 1 7s2 5 0 7-6 2-8-1-1-6 1-8 4-2 6 0M9 12h.01M13 15h.01'),
  neurological: S('M9 4a4 4 0 0 0-3 6 3 3 0 0 0 0 5 3 3 0 0 0 4 2 3 3 0 0 0 4-2 3 3 0 0 0 0-5 4 4 0 0 0-3-6M12 4v14'),
  musculoskeletal: S('M7 4l3 3M4 7l3-3M17 20l-3-3M20 17l-3 3M9 9l6 6'),
  skin: S('M12 3c3 3 6 6 6 10a6 6 0 1 1-12 0c0-4 3-7 6-10zM10 15a2 2 0 0 0 4 0'),
  urinary: S('M12 3c3 4 5 6.5 5 9a5 5 0 1 1-10 0c0-2.5 2-5 5-9z'),
  follow_up: S('M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6'),
  medication_refill: S('M7 12l5-5a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5-5zM9.5 9.5l5 5'),
  other: S('M12 4v16M4 12h16'),
};

export function SymptomsStep({
  symptoms,
  customComplaint,
  onSymptoms,
  onCustom,
}: {
  symptoms: SelectedSymptom[];
  customComplaint: string;
  onSymptoms: (v: SelectedSymptom[]) => void;
  onCustom: (v: string) => void;
}) {
  const [open, setOpen] = useState<SymptomCategoryId[]>(() =>
    Array.from(new Set(symptoms.map((s) => s.category))),
  );

  const countIn = (cat: SymptomCategoryId) => symptoms.filter((s) => s.category === cat).length;

  function toggleCard(cat: SymptomCategoryId) {
    if (open.includes(cat)) {
      setOpen(open.filter((c) => c !== cat));
      onSymptoms(symptoms.filter((s) => s.category !== cat));
    } else {
      setOpen([...open, cat]);
    }
  }

  function toggleSymptom(cat: SymptomCategoryId, id: string, label: string) {
    const has = symptoms.some((s) => s.category === cat && s.id === id);
    onSymptoms(
      has
        ? symptoms.filter((s) => !(s.category === cat && s.id === id))
        : [...symptoms, { category: cat, id, label }],
    );
  }

  return (
    <div>
      <div className="c-cards">
        {SYMPTOM_CATEGORIES.map((cat, i) => {
          const active = open.includes(cat.id);
          const n = countIn(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              className={`c-card${active ? ' is-on' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => toggleCard(cat.id)}
              aria-pressed={active}
            >
              <span className="c-card__icon">{ICON[cat.id]}</span>
              <span className="c-card__label">{cat.label}</span>
              <span className="c-card__tag">{cat.tagline}</span>
              {n > 0 ? <span className="c-card__count">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {open.length > 0 ? (
        <div className="c-refine">
          {SYMPTOM_CATEGORIES.filter((c) => open.includes(c.id)).map((cat) => (
            <div key={cat.id} className="c-refine__group">
              <div className="c-refine__title">{cat.label}</div>
              {cat.common.length > 0 ? (
                <div className="c-chips">
                  {cat.common.map((item) => {
                    const on = symptoms.some((s) => s.category === cat.id && s.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`c-chip${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => toggleSymptom(cat.id, item.id, item.label)}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="c-refine__note">Describe it in the box below and a doctor will take it from there.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="c-hint-line">Tap the areas that match how you feel. You can pick more than one.</p>
      )}

      <div className="c-field c-field--full" style={{ marginTop: 26 }}>
        <label className="c-field__label">
          Add a custom complaint<span className="c-field__hint">optional</span>
        </label>
        <TextArea
          value={customComplaint}
          onChange={onCustom}
          rows={3}
          placeholder="In your own words — what’s bothering you and since when?"
        />
      </div>
    </div>
  );
}
