import { Field, Segmented, TextArea } from '../../../components/consult/fields';
import type { MedicalHistory } from '../../../types/consultation';

export function MedicalHistoryStep({
  value,
  onChange,
}: {
  value: MedicalHistory;
  onChange: (v: MedicalHistory) => void;
}) {
  const set =
    (k: keyof MedicalHistory) =>
    (v: string) =>
      onChange({ ...value, [k]: v });

  return (
    <div className="c-grid">
      <Field label="Past medical history" hint="conditions you’ve had" full>
        <TextArea value={value.pastMedical} onChange={set('pastMedical')} placeholder="Diabetes, asthma, thyroid… or “none”" />
      </Field>
      <Field label="Previous surgeries" full>
        <TextArea value={value.surgeries} onChange={set('surgeries')} rows={2} placeholder="With rough dates, if any" />
      </Field>
      <Field label="Food allergies">
        <TextArea value={value.foodAllergies} onChange={set('foodAllergies')} rows={2} placeholder="e.g. peanuts" />
      </Field>
      <Field label="Drug allergies">
        <TextArea value={value.drugAllergies} onChange={set('drugAllergies')} rows={2} placeholder="e.g. penicillin" />
      </Field>
      <Field label="Current medications" hint="name & dose" full>
        <TextArea value={value.medications} onChange={set('medications')} placeholder="Everything you take regularly" />
      </Field>
      <Field label="Smoking">
        <Segmented
          value={value.smoking}
          onChange={set('smoking')}
          options={[
            { value: 'never', label: 'Never' },
            { value: 'former', label: 'Former' },
            { value: 'current', label: 'Current' },
          ]}
        />
      </Field>
      <Field label="Alcohol">
        <Segmented
          value={value.alcohol}
          onChange={set('alcohol')}
          options={[
            { value: 'never', label: 'Never' },
            { value: 'occasional', label: 'Occasional' },
            { value: 'regular', label: 'Regular' },
          ]}
        />
      </Field>
      <Field label="Additional notes" full>
        <TextArea value={value.notes} onChange={set('notes')} placeholder="Anything else you’d like the doctor to know" />
      </Field>
    </div>
  );
}
