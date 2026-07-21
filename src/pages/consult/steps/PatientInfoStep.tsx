import { Field, Segmented, TextInput } from '../../../components/consult/fields';
import type { Gender, PatientInfo } from '../../../types/consultation';

function ageFromDob(dob: string): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? String(age) : '';
}

export function PatientInfoStep({
  value,
  onChange,
}: {
  value: PatientInfo;
  onChange: (v: PatientInfo) => void;
}) {
  const set =
    (k: Exclude<keyof PatientInfo, 'gender'>) =>
    (v: string) =>
      onChange({ ...value, [k]: v });
  const setDob = (v: string) => onChange({ ...value, dob: v, age: ageFromDob(v) || value.age });

  return (
    <div className="c-grid">
      <Field label="Full name" full>
        <TextInput value={value.fullName} onChange={set('fullName')} autoComplete="name" placeholder="Your legal name" />
      </Field>
      <Field label="Date of birth">
        <TextInput type="date" value={value.dob} onChange={setDob} />
      </Field>
      <Field label="Age" hint="auto-filled from date of birth">
        <TextInput value={value.age} onChange={set('age')} inputMode="numeric" placeholder="Years" />
      </Field>
      <Field label="Gender" full>
        <Segmented
          value={value.gender}
          onChange={(v) => onChange({ ...value, gender: v as Gender })}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
            { value: 'other', label: 'Other' },
          ]}
        />
      </Field>
      <Field label="Height">
        <TextInput value={value.heightCm} onChange={set('heightCm')} inputMode="numeric" placeholder="cm" />
      </Field>
      <Field label="Weight">
        <TextInput value={value.weightKg} onChange={set('weightKg')} inputMode="numeric" placeholder="kg" />
      </Field>
      <Field label="Phone number">
        <TextInput value={value.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="+977 98…" />
      </Field>
      <Field label="Email">
        <TextInput value={value.email} onChange={set('email')} inputMode="email" autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field label="Address" full>
        <TextInput value={value.address} onChange={set('address')} autoComplete="street-address" placeholder="City, district" />
      </Field>
    </div>
  );
}
