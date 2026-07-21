import type { MedicalHistory, Surgery, HistoryMedication } from '../types/consultation';

// Option lists + section icons for the Medical History step. Kept as plain data
// so the component stays presentational. 'None' and 'Other' are sentinels the
// MultiSelect treats specially (None clears + locks the group; Other reveals a
// "please specify" input).

export const NONE = 'None';
export const OTHER = 'Other';

export const PAST_CONDITIONS = [
  'Hypertension',
  'Diabetes',
  'Asthma',
  'COPD',
  'Heart Disease',
  'Kidney Disease',
  'Liver Disease',
  'Stroke',
  'Thyroid Disease',
  'Tuberculosis',
  'Hepatitis',
  'Cancer',
  'Psychiatric Illness',
  'Pregnancy',
];

export const FOOD_ALLERGENS = [
  'Peanuts',
  'Eggs',
  'Milk',
  'Seafood',
  'Shellfish',
  'Soy',
  'Wheat',
  'Tree Nuts',
];

export const DRUG_ALLERGENS = [
  'Penicillin',
  'Sulfa Drugs',
  'NSAIDs',
  'Aspirin',
  'Cephalosporins',
  'Contrast Dye',
  'Latex',
];

export const ENV_ALLERGENS = ['Dust', 'Pollen', 'Pet Dander', 'Mold', 'Smoke', 'Perfume'];

export const SMOKING = ['Never', 'Former Smoker', 'Current Smoker'];
export const ALCOHOL = ['Never', 'Occasionally', 'Weekly', 'Daily'];
export const EXERCISE = ['Never', '1–2 days/week', '3–5 days/week', 'Daily'];

export const OCCUPATIONS = [
  'Student',
  'Office Worker',
  'Healthcare Worker',
  'Teacher',
  'Engineer',
  'Business',
  'Driver',
  'Farmer',
  'Construction',
  'Retired',
];

// Section icons — simple 24px line glyphs that inherit currentColor.
export type IconName =
  | 'history'
  | 'scalpel'
  | 'allergy'
  | 'pill'
  | 'lifestyle'
  | 'work'
  | 'note';

export const SECTION_ICON: Record<IconName, string> = {
  history:
    '<path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /><path d="M3 12a9 9 0 0 1 9-9" opacity="0.35" />',
  scalpel:
    '<path d="M14 4l6 6-9 9-4 1 1-4 6-6" /><path d="M4 20l3-3" />',
  allergy:
    '<path d="M12 3v6" /><path d="M12 21a6 6 0 0 0 6-6c0-3-2.5-5-6-9-3.5 4-6 6-6 9a6 6 0 0 0 6 6z" /><path d="M9 15h6" />',
  pill:
    '<rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" />',
  lifestyle:
    '<path d="M12 21c5-3 8-6.5 8-11a4 4 0 0 0-8-1 4 4 0 0 0-8 1c0 4.5 3 8 8 11z" />',
  work:
    '<rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />',
  note:
    '<path d="M4 4h16v12l-4 4H4z" /><path d="M16 16v4l4-4z" /><path d="M8 9h8M8 13h5" />',
};

/* ------------------------------------------------------------------ summary */

/**
 * Flatten a MedicalHistory into readable label/value rows for the review screen
 * and the doctor's chart. Tolerant of BOTH the structured shape and the old
 * free-text shape (older Firestore docs), so nothing crashes mid-migration.
 */
export function summarizeHistory(h: MedicalHistory | undefined | null): {
  label: string;
  value: string;
}[] {
  if (!h) return [];
  const legacy = h as unknown as Record<string, string>;
  const rows: { label: string; value: string }[] = [];

  const group = (arr: unknown, other?: string): string => {
    const list = Array.isArray(arr)
      ? (arr as string[]).filter((x) => x && x !== OTHER)
      : arr
        ? [String(arr)]
        : [];
    if (other && other.trim()) list.push(other.trim());
    return list.join(', ');
  };

  const past = Array.isArray(h.pastMedicalHistory)
    ? group(h.pastMedicalHistory, h.pastMedicalOther)
    : legacy.pastMedical || '';
  if (past) rows.push({ label: 'Past history', value: past });

  if (Array.isArray(h.surgeries)) {
    const s = (h.surgeries as Surgery[])
      .map((x) => [x.name, x.date, x.hospital].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('; ');
    if (s) rows.push({ label: 'Surgeries', value: s });
    else if (h.hasSurgery === 'no') rows.push({ label: 'Surgeries', value: 'None' });
  } else if (legacy.surgeries) {
    rows.push({ label: 'Surgeries', value: legacy.surgeries });
  }

  const food = Array.isArray(h.foodAllergies)
    ? group(h.foodAllergies, h.foodAllergiesOther)
    : legacy.foodAllergies || '';
  if (food) rows.push({ label: 'Food allergies', value: food });

  const drug = Array.isArray(h.drugAllergies)
    ? group(h.drugAllergies, h.drugAllergiesOther)
    : legacy.drugAllergies || '';
  if (drug) rows.push({ label: 'Drug allergies', value: drug });

  const env = group(h.environmentalAllergies, h.environmentalAllergiesOther);
  if (env) rows.push({ label: 'Environmental allergies', value: env });

  if (h.otherAllergies) rows.push({ label: 'Other allergies', value: h.otherAllergies });

  if (Array.isArray(h.currentMedications)) {
    const m = (h.currentMedications as HistoryMedication[])
      .map((x) => [x.name, x.dose, x.frequency, x.duration].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('; ');
    if (m) rows.push({ label: 'Medications', value: m });
  } else if (legacy.medications) {
    rows.push({ label: 'Medications', value: legacy.medications });
  }

  const life = [
    h.smoking && `Smoking: ${h.smoking}`,
    h.alcohol && `Alcohol: ${h.alcohol}`,
    h.exercise && `Exercise: ${h.exercise}`,
  ]
    .filter(Boolean)
    .join(' · ');
  if (life) rows.push({ label: 'Lifestyle', value: life });

  const occ = h.occupation === OTHER ? h.occupationOther : h.occupation;
  if (occ) rows.push({ label: 'Occupation', value: occ });

  const notes = h.additionalNotes || legacy.notes;
  if (notes) rows.push({ label: 'Notes', value: notes });

  return rows;
}
