import type { SelectedSymptom, SymptomCategoryId } from '../types/consultation';

export interface CommonSymptom {
  id: string;
  label: string;
}

export interface SymptomCategory {
  id: SymptomCategoryId;
  label: string;
  tagline: string;
  common: CommonSymptom[];
}

/** The ten intake categories shown as animated cards in step 2. */
export const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  { id: 'respiratory', label: 'Respiratory', tagline: 'Breathing, cough, throat', common: [
    { id: 'cough', label: 'Cough' }, { id: 'breathlessness', label: 'Shortness of breath' },
    { id: 'sore_throat', label: 'Sore throat' }, { id: 'runny_nose', label: 'Runny / blocked nose' },
    { id: 'fever', label: 'Fever' }, { id: 'wheezing', label: 'Wheezing' } ] },
  { id: 'cardiovascular', label: 'Cardiovascular', tagline: 'Heart, blood pressure', common: [
    { id: 'chest_pain', label: 'Chest pain' }, { id: 'palpitations', label: 'Palpitations' },
    { id: 'high_bp', label: 'High blood pressure' }, { id: 'leg_swelling', label: 'Leg swelling' },
    { id: 'fainting', label: 'Fainting' } ] },
  { id: 'gastrointestinal', label: 'Gastrointestinal', tagline: 'Stomach, digestion', common: [
    { id: 'abdominal_pain', label: 'Abdominal pain' }, { id: 'nausea', label: 'Nausea / vomiting' },
    { id: 'diarrhea', label: 'Diarrhea' }, { id: 'constipation', label: 'Constipation' },
    { id: 'heartburn', label: 'Heartburn' } ] },
  { id: 'neurological', label: 'Neurological', tagline: 'Head, nerves, balance', common: [
    { id: 'headache', label: 'Headache' }, { id: 'dizziness', label: 'Dizziness' },
    { id: 'numbness', label: 'Numbness / tingling' }, { id: 'weakness', label: 'Weakness' } ] },
  { id: 'musculoskeletal', label: 'Musculoskeletal', tagline: 'Joints, muscles, back', common: [
    { id: 'joint_pain', label: 'Joint pain' }, { id: 'back_pain', label: 'Back pain' },
    { id: 'muscle_pain', label: 'Muscle pain' }, { id: 'stiffness', label: 'Stiffness' } ] },
  { id: 'skin', label: 'Skin', tagline: 'Rashes, itching, wounds', common: [
    { id: 'rash', label: 'Rash' }, { id: 'itching', label: 'Itching' },
    { id: 'acne', label: 'Acne' }, { id: 'wound', label: 'Wound / infection' } ] },
  { id: 'urinary', label: 'Urinary', tagline: 'Urination, kidney', common: [
    { id: 'painful_urination', label: 'Painful urination' },
    { id: 'frequent_urination', label: 'Frequent urination' },
    { id: 'blood_urine', label: 'Blood in urine' } ] },
  { id: 'follow_up', label: 'Follow-up', tagline: 'Review an ongoing case', common: [
    { id: 'review_results', label: 'Review test results' },
    { id: 'post_treatment', label: 'Post-treatment check' },
    { id: 'ongoing_condition', label: 'Ongoing condition' } ] },
  { id: 'medication_refill', label: 'Medication Refill', tagline: 'Renew a prescription', common: [
    { id: 'refill', label: 'Refill a prescription' } ] },
  { id: 'other', label: 'Other', tagline: 'Something else', common: [] },
];

export const CATEGORY_LABEL: Record<SymptomCategoryId, string> = Object.fromEntries(
  SYMPTOM_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<SymptomCategoryId, string>;

// ---------------------------------------------------------------------------
// Dynamic follow-up questions (step 3). Keyed by specific-symptom id.
// ---------------------------------------------------------------------------
export type QuestionType = 'select' | 'chips' | 'text' | 'number' | 'textarea' | 'yesno';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  unit?: string;
}

const DURATION = ['Less than a day', '1–3 days', '4–7 days', '1–2 weeks', 'More than 2 weeks'];
const SEVERITY = ['Mild', 'Moderate', 'Severe'];

const SPECIFIC: Record<string, Question[]> = {
  fever: [
    { id: 'duration', label: 'How long have you had it?', type: 'select', options: DURATION },
    { id: 'temperature', label: 'Highest temperature measured', type: 'number', unit: '°F', placeholder: 'e.g. 101' },
    { id: 'chills', label: 'Any chills or shivering?', type: 'yesno' },
  ],
  cough: [
    { id: 'type', label: 'Is the cough dry or productive?', type: 'select', options: ['Dry', 'Productive (with phlegm)'] },
    { id: 'sputum', label: 'Phlegm colour, if any', type: 'select', options: ['None', 'Clear / white', 'Yellow', 'Green', 'Blood-streaked'] },
    { id: 'duration', label: 'How long have you had it?', type: 'select', options: DURATION },
  ],
  breathlessness: [
    { id: 'severity', label: 'How severe is it?', type: 'select', options: SEVERITY },
    { id: 'when', label: 'When does it happen?', type: 'select', options: ['On exertion', 'At rest', 'Lying down', 'All the time'] },
  ],
  chest_pain: [
    { id: 'severity', label: 'Rate the pain', type: 'select', options: ['1–3 (mild)', '4–6 (moderate)', '7–10 (severe)'] },
    { id: 'onset', label: 'How did it start?', type: 'select', options: ['Sudden', 'Gradual'] },
    { id: 'radiation', label: 'Does it spread anywhere?', type: 'select', options: ['No', 'Left arm', 'Jaw / neck', 'Back'] },
  ],
  high_bp: [
    { id: 'current_bp', label: 'Your latest blood-pressure reading', type: 'text', placeholder: 'e.g. 150 / 95' },
    { id: 'associated', label: 'Any of these with it?', type: 'chips', options: ['Headache', 'Blurred vision', 'Chest pain', 'Palpitations', 'None'] },
  ],
  abdominal_pain: [
    { id: 'location', label: 'Where is the pain?', type: 'select', options: ['Upper abdomen', 'Lower abdomen', 'Right side', 'Left side', 'Whole abdomen'] },
    { id: 'severity', label: 'How severe?', type: 'select', options: SEVERITY },
    { id: 'duration', label: 'How long?', type: 'select', options: DURATION },
  ],
  headache: [
    { id: 'type', label: 'What does it feel like?', type: 'select', options: ['Throbbing', 'Pressure / tight band', 'Sharp', 'Dull ache'] },
    { id: 'severity', label: 'How severe?', type: 'select', options: SEVERITY },
    { id: 'duration', label: 'How long?', type: 'select', options: DURATION },
  ],
  refill: [
    { id: 'medication', label: 'Which medication needs a refill?', type: 'text', placeholder: 'Name & strength' },
    { id: 'last_prescribed', label: 'When was it last prescribed?', type: 'text', placeholder: 'e.g. 3 months ago' },
  ],
};

/**
 * Questions for a selected symptom — specific if configured, otherwise a
 * sensible generic set — with ids namespaced so answers never collide.
 */
export function questionsForSymptom(sym: SelectedSymptom): Question[] {
  const base: Question[] =
    SPECIFIC[sym.id] ?? [
      { id: 'duration', label: 'How long has this been going on?', type: 'select', options: DURATION },
      { id: 'severity', label: 'How would you rate it?', type: 'select', options: SEVERITY },
      { id: 'detail', label: 'Anything else the doctor should know?', type: 'textarea', placeholder: 'Optional' },
    ];
  return base.map((q) => ({ ...q, id: `${sym.id}:${q.id}` }));
}
