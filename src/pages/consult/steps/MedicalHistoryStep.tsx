import { useMemo, useState } from 'react';
import type {
  MedicalHistory,
  Surgery,
  HistoryMedication,
} from '../../../types/consultation';
import {
  NONE,
  OTHER,
  PAST_CONDITIONS,
  FOOD_ALLERGENS,
  DRUG_ALLERGENS,
  ENV_ALLERGENS,
  SMOKING,
  ALCOHOL,
  EXERCISE,
  OCCUPATIONS,
  SECTION_ICON,
  type IconName,
} from '../../../config/medicalHistory';

/* ----------------------------------------------------------------- helpers */

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="mh-sec__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SECTION_ICON[name] }}
    />
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mh-sec">
      <header className="mh-sec__head">
        <span className="mh-sec__badge">
          <Icon name={icon} />
        </span>
        <div>
          <h2 className="mh-sec__title">{title}</h2>
          {hint ? <p className="mh-sec__hint">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Animated check-card used across the multi-selects. */
function CheckCard({
  label,
  on,
  disabled,
  tone,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  tone?: 'none';
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`mh-card${on ? ' is-on' : ''}${tone === 'none' ? ' mh-card--none' : ''}`}
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="mh-card__check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="mh-card__label">{label}</span>
    </button>
  );
}

/**
 * A searchable multi-select grid with None/Other semantics.
 *  - Selecting None replaces the selection with [None] and locks the rest.
 *  - Selecting any real option clears None.
 *  - Other reveals a "please specify" input (text stored separately).
 */
function MultiSelect({
  options,
  value,
  onChange,
  otherText,
  onOtherText,
  otherPlaceholder = 'Please specify',
  searchable,
  searchPlaceholder = 'Search…',
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  otherText: string;
  onOtherText: (v: string) => void;
  otherPlaceholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const noneOn = value.includes(NONE);
  const otherOn = value.includes(OTHER);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(opt: string) {
    if (opt === NONE) {
      onChange(noneOn ? [] : [NONE]);
      return;
    }
    // any real (or Other) selection clears the None sentinel
    const base = value.filter((v) => v !== NONE);
    onChange(base.includes(opt) ? base.filter((v) => v !== opt) : [...base, opt]);
  }

  return (
    <div className="mh-group">
      {searchable ? (
        <div className="mh-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            className="mh-search__input"
            type="text"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}

      <div className="mh-cards">
        {filtered.map((opt) => (
          <CheckCard
            key={opt}
            label={opt}
            on={value.includes(opt)}
            disabled={noneOn && opt !== NONE}
            onToggle={() => toggle(opt)}
          />
        ))}
        <CheckCard label={OTHER} on={otherOn} disabled={noneOn} onToggle={() => toggle(OTHER)} />
        <CheckCard label={NONE} on={noneOn} tone="none" onToggle={() => toggle(NONE)} />
      </div>

      {otherOn ? (
        <input
          className="c-input mh-other"
          type="text"
          value={otherText}
          placeholder={otherPlaceholder}
          onChange={(e) => onOtherText(e.target.value)}
        />
      ) : null}
    </div>
  );
}

/** A single-select row of pill cards (lifestyle + surgery yes/no). */
function PillSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mh-pills" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          className={`mh-pill${value === opt ? ' is-on' : ''}`}
          onClick={() => onChange(value === opt ? '' : opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ screen */

export function MedicalHistoryStep({
  value,
  onChange,
}: {
  value: MedicalHistory;
  onChange: (v: MedicalHistory) => void;
}) {
  const set = <K extends keyof MedicalHistory>(k: K, v: MedicalHistory[K]) =>
    onChange({ ...value, [k]: v });

  /* -- surgery repeater -- */
  const addSurgery = () =>
    onChange({ ...value, surgeries: [...value.surgeries, { name: '', date: '', hospital: '' }] });
  const setSurgery = (i: number, patch: Partial<Surgery>) =>
    onChange({
      ...value,
      surgeries: value.surgeries.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  const removeSurgery = (i: number) =>
    onChange({ ...value, surgeries: value.surgeries.filter((_, idx) => idx !== i) });

  function setHasSurgery(v: string) {
    if (v === 'yes' && value.surgeries.length === 0) {
      onChange({ ...value, hasSurgery: v, surgeries: [{ name: '', date: '', hospital: '' }] });
    } else if (v === 'no') {
      onChange({ ...value, hasSurgery: v, surgeries: [] });
    } else {
      set('hasSurgery', v);
    }
  }

  /* -- medication repeater -- */
  const addMed = () =>
    onChange({
      ...value,
      currentMedications: [
        ...value.currentMedications,
        { name: '', dose: '', frequency: '', duration: '' },
      ],
    });
  const setMed = (i: number, patch: Partial<HistoryMedication>) =>
    onChange({
      ...value,
      currentMedications: value.currentMedications.map((m, idx) =>
        idx === i ? { ...m, ...patch } : m,
      ),
    });
  const removeMed = (i: number) =>
    onChange({
      ...value,
      currentMedications: value.currentMedications.filter((_, idx) => idx !== i),
    });

  return (
    <div className="mh">
      {/* 1 — Past medical history */}
      <Section icon="history" title="Past medical history" hint="Tap any conditions you’ve been diagnosed with.">
        <MultiSelect
          options={PAST_CONDITIONS}
          value={value.pastMedicalHistory}
          onChange={(v) => set('pastMedicalHistory', v)}
          otherText={value.pastMedicalOther}
          onOtherText={(v) => set('pastMedicalOther', v)}
          otherPlaceholder="Which condition?"
          searchable
          searchPlaceholder="Search conditions…"
        />
      </Section>

      {/* 2 — Previous surgery */}
      <Section icon="scalpel" title="Previous surgery">
        <PillSelect
          options={['No previous surgery', 'Yes']}
          value={value.hasSurgery === 'no' ? 'No previous surgery' : value.hasSurgery === 'yes' ? 'Yes' : ''}
          onChange={(v) => setHasSurgery(v === 'Yes' ? 'yes' : 'no')}
        />
        {value.hasSurgery === 'yes' ? (
          <div className="mh-repeat">
            {value.surgeries.map((s, i) => (
              <div className="mh-item" key={i}>
                <div className="mh-item__grid">
                  <input
                    className="c-input"
                    placeholder="Surgery name"
                    value={s.name}
                    onChange={(e) => setSurgery(i, { name: e.target.value })}
                  />
                  <input
                    className="c-input"
                    placeholder="Year / date"
                    value={s.date}
                    onChange={(e) => setSurgery(i, { date: e.target.value })}
                  />
                  <input
                    className="c-input"
                    placeholder="Hospital"
                    value={s.hospital}
                    onChange={(e) => setSurgery(i, { hospital: e.target.value })}
                  />
                </div>
                <button type="button" className="mh-remove" onClick={() => removeSurgery(i)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="mh-add" onClick={addSurgery}>
              + Add another surgery
            </button>
          </div>
        ) : null}
      </Section>

      {/* 3 — Allergies */}
      <Section icon="allergy" title="Allergies" hint="Food, drug, and environmental triggers.">
        <div className="mh-sub">
          <h3 className="mh-sub__title">Food allergies</h3>
          <MultiSelect
            options={FOOD_ALLERGENS}
            value={value.foodAllergies}
            onChange={(v) => set('foodAllergies', v)}
            otherText={value.foodAllergiesOther}
            onOtherText={(v) => set('foodAllergiesOther', v)}
          />
        </div>
        <div className="mh-sub">
          <h3 className="mh-sub__title">Drug allergies</h3>
          <MultiSelect
            options={DRUG_ALLERGENS}
            value={value.drugAllergies}
            onChange={(v) => set('drugAllergies', v)}
            otherText={value.drugAllergiesOther}
            onOtherText={(v) => set('drugAllergiesOther', v)}
          />
        </div>
        <div className="mh-sub">
          <h3 className="mh-sub__title">Environmental allergies</h3>
          <MultiSelect
            options={ENV_ALLERGENS}
            value={value.environmentalAllergies}
            onChange={(v) => set('environmentalAllergies', v)}
            otherText={value.environmentalAllergiesOther}
            onOtherText={(v) => set('environmentalAllergiesOther', v)}
          />
        </div>
        <div className="mh-sub">
          <h3 className="mh-sub__title">
            Other allergies <span className="mh-sub__opt">optional</span>
          </h3>
          <input
            className="c-input"
            type="text"
            value={value.otherAllergies}
            placeholder="Anything else you react to"
            onChange={(e) => set('otherAllergies', e.target.value)}
          />
        </div>
      </Section>

      {/* 4 — Current medications */}
      <Section icon="pill" title="Current medications" hint="Everything you take regularly.">
        {value.currentMedications.length === 0 ? (
          <p className="mh-empty">No medications added yet.</p>
        ) : (
          <div className="mh-repeat">
            {value.currentMedications.map((m, i) => (
              <div className="mh-item" key={i}>
                <div className="mh-item__grid mh-item__grid--4">
                  <input
                    className="c-input"
                    placeholder="Medicine name"
                    value={m.name}
                    onChange={(e) => setMed(i, { name: e.target.value })}
                  />
                  <input
                    className="c-input"
                    placeholder="Dose"
                    value={m.dose}
                    onChange={(e) => setMed(i, { dose: e.target.value })}
                  />
                  <input
                    className="c-input"
                    placeholder="Frequency"
                    value={m.frequency}
                    onChange={(e) => setMed(i, { frequency: e.target.value })}
                  />
                  <input
                    className="c-input"
                    placeholder="Duration"
                    value={m.duration}
                    onChange={(e) => setMed(i, { duration: e.target.value })}
                  />
                </div>
                <button type="button" className="mh-remove" onClick={() => removeMed(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="mh-add" onClick={addMed}>
          + Add another medication
        </button>
      </Section>

      {/* 5 — Lifestyle */}
      <Section icon="lifestyle" title="Lifestyle">
        <div className="mh-life">
          <div className="mh-life__row">
            <span className="mh-life__label">Smoking</span>
            <PillSelect options={SMOKING} value={value.smoking} onChange={(v) => set('smoking', v)} />
          </div>
          <div className="mh-life__row">
            <span className="mh-life__label">Alcohol</span>
            <PillSelect options={ALCOHOL} value={value.alcohol} onChange={(v) => set('alcohol', v)} />
          </div>
          <div className="mh-life__row">
            <span className="mh-life__label">Exercise</span>
            <PillSelect options={EXERCISE} value={value.exercise} onChange={(v) => set('exercise', v)} />
          </div>
        </div>
      </Section>

      {/* Occupation */}
      <Section icon="work" title="Occupation">
        <MultiSelectSingle
          options={OCCUPATIONS}
          value={value.occupation}
          onChange={(v) => set('occupation', v)}
          otherText={value.occupationOther}
          onOtherText={(v) => set('occupationOther', v)}
        />
      </Section>

      {/* 6 — Additional notes */}
      <Section icon="note" title="Additional notes">
        <textarea
          className="c-input c-textarea"
          rows={3}
          value={value.additionalNotes}
          placeholder="Is there anything else you’d like your doctor to know?"
          onChange={(e) => set('additionalNotes', e.target.value)}
        />
      </Section>
    </div>
  );
}

/** Searchable single-select (occupation) with an Other → text field. */
function MultiSelectSingle({
  options,
  value,
  onChange,
  otherText,
  onOtherText,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  otherText: string;
  onOtherText: (v: string) => void;
}) {
  const [query, setQuery] = useState('');
  const otherOn = value === OTHER;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="mh-group">
      <div className="mh-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
        <input
          className="mh-search__input"
          type="text"
          value={query}
          placeholder="Search occupations…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mh-cards">
        {filtered.map((opt) => (
          <CheckCard key={opt} label={opt} on={value === opt} onToggle={() => onChange(value === opt ? '' : opt)} />
        ))}
        <CheckCard label={OTHER} on={otherOn} onToggle={() => onChange(otherOn ? '' : OTHER)} />
      </div>
      {otherOn ? (
        <input
          className="c-input mh-other"
          type="text"
          value={otherText}
          placeholder="Your occupation"
          onChange={(e) => onOtherText(e.target.value)}
        />
      ) : null}
    </div>
  );
}
