import type { Timestamp } from 'firebase/firestore';

export type Gender = 'female' | 'male' | 'other';

export interface PatientInfo {
  fullName: string;
  age: string;
  dob: string;
  gender: Gender | '';
  heightCm: string;
  weightKg: string;
  phone: string;
  email: string;
  address: string;
}

export type SymptomCategoryId =
  | 'respiratory'
  | 'cardiovascular'
  | 'gastrointestinal'
  | 'neurological'
  | 'musculoskeletal'
  | 'skin'
  | 'urinary'
  | 'follow_up'
  | 'medication_refill'
  | 'other';

/** A specific complaint the patient selected (or typed). */
export interface SelectedSymptom {
  category: SymptomCategoryId;
  id: string; // e.g. 'cough' or 'custom-…'
  label: string;
  custom?: boolean;
}

/** Answers to the dynamic follow-up questions, keyed by question id. */
export type QuestionnaireAnswers = Record<string, string | string[]>;

export interface MedicalHistory {
  pastMedical: string;
  surgeries: string;
  foodAllergies: string;
  drugAllergies: string;
  medications: string;
  smoking: string; // 'never' | 'former' | 'current'
  alcohol: string; // 'never' | 'occasional' | 'regular'
  notes: string;
}

export type PaymentStatus = 'pending_verification' | 'verified' | 'rejected';

export interface PaymentInfo {
  method: 'esewa';
  fee: number;
  status: PaymentStatus;
  screenshotUrl: string;
  reference: string;
}

/** Ordered lifecycle of a consultation (drives the tracking timeline). */
export type ConsultationStatus =
  | 'submitted'
  | 'payment_pending'
  | 'payment_verified'
  | 'doctor_assigned'
  | 'doctor_reviewing'
  | 'doctor_contacting'
  | 'in_progress'
  | 'prescription_ready'
  | 'completed';

export interface StatusEvent {
  status: ConsultationStatus;
  at: Timestamp | null;
}

export interface Consultation {
  id: string;
  patientId: string;
  patient: PatientInfo;
  symptoms: SelectedSymptom[];
  customComplaint: string;
  answers: QuestionnaireAnswers;
  history: MedicalHistory;
  payment: PaymentInfo;
  status: ConsultationStatus;
  statusHistory: StatusEvent[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Client-side draft held by the wizard before it is submitted. */
export interface ConsultationDraft {
  patient: PatientInfo;
  symptoms: SelectedSymptom[];
  customComplaint: string;
  answers: QuestionnaireAnswers;
  history: MedicalHistory;
}

export function emptyDraft(prefillEmail = '', prefillName = ''): ConsultationDraft {
  return {
    patient: {
      fullName: prefillName,
      age: '',
      dob: '',
      gender: '',
      heightCm: '',
      weightKg: '',
      phone: '',
      email: prefillEmail,
      address: '',
    },
    symptoms: [],
    customComplaint: '',
    answers: {},
    history: {
      pastMedical: '',
      surgeries: '',
      foodAllergies: '',
      drugAllergies: '',
      medications: '',
      smoking: '',
      alcohol: '',
      notes: '',
    },
  };
}
