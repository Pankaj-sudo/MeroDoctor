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

/** One prior operation (the surgery repeater). */
export interface Surgery {
  name: string;
  date: string;
  hospital: string;
}

/** One medication the patient currently takes (the medication repeater). */
export interface HistoryMedication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
}

/**
 * Structured patient history. Multi-select groups store the chosen labels; a
 * group holding the sentinel 'None' means "explicitly none" (vs. an empty array
 * = not answered). The `*Other` strings carry the "please specify" free text.
 */
export interface MedicalHistory {
  pastMedicalHistory: string[];
  pastMedicalOther: string;
  hasSurgery: string; // '' | 'no' | 'yes'
  surgeries: Surgery[];
  foodAllergies: string[];
  foodAllergiesOther: string;
  drugAllergies: string[];
  drugAllergiesOther: string;
  environmentalAllergies: string[];
  environmentalAllergiesOther: string;
  otherAllergies: string;
  currentMedications: HistoryMedication[];
  smoking: string;
  alcohol: string;
  exercise: string;
  occupation: string;
  occupationOther: string;
  additionalNotes: string;
}

export function emptyMedicalHistory(): MedicalHistory {
  return {
    pastMedicalHistory: [],
    pastMedicalOther: '',
    hasSurgery: '',
    surgeries: [],
    foodAllergies: [],
    foodAllergiesOther: '',
    drugAllergies: [],
    drugAllergiesOther: '',
    environmentalAllergies: [],
    environmentalAllergiesOther: '',
    otherAllergies: '',
    currentMedications: [],
    smoking: '',
    alcohol: '',
    exercise: '',
    occupation: '',
    occupationOther: '',
    additionalNotes: '',
  };
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

export type Priority = 'routine' | 'urgent';

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  medications: Medication[];
  advice: string;
}

/** Clinical documentation the doctor fills in. All optional until entered. */
export interface Clinical {
  soapSubjective: string;
  soapObjective: string;
  soapAssessment: string;
  soapPlan: string;
  diagnosis: string;
  differential: string;
  investigations: string;
  treatmentPlan: string;
  prescription: Prescription;
  followUpDate: string;
  patientInstructions: string;
}

export function emptyClinical(): Clinical {
  return {
    soapSubjective: '',
    soapObjective: '',
    soapAssessment: '',
    soapPlan: '',
    diagnosis: '',
    differential: '',
    investigations: '',
    treatmentPlan: '',
    prescription: { medications: [], advice: '' },
    followUpDate: '',
    patientInstructions: '',
  };
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
  // ---- doctor side (set as the case is worked) ----
  priority?: Priority;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  clinical?: Clinical;
  paymentReviewedBy?: string;
  paymentReviewedAt?: Timestamp | null;
  paymentNote?: string;
}

/** Audit-trail entry written for every doctor action (activity_logs). */
export interface ActivityLog {
  id: string;
  consultationId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
  at: Timestamp | null;
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
    history: emptyMedicalHistory(),
  };
}
