import type { ConsultationStatus } from '../types/consultation';

/** The consultation lifecycle, in order — drives the tracking timeline. */
export const STATUS_ORDER: ConsultationStatus[] = [
  'submitted',
  'payment_pending',
  'payment_verified',
  'doctor_assigned',
  'doctor_reviewing',
  'doctor_contacting',
  'in_progress',
  'prescription_ready',
  'completed',
];

export const STATUS_META: Record<ConsultationStatus, { label: string; desc: string }> = {
  submitted: { label: 'Consultation Submitted', desc: 'We’ve received your intake.' },
  payment_pending: { label: 'Payment Pending', desc: 'Verifying your eSewa payment.' },
  payment_verified: { label: 'Payment Verified', desc: 'Payment confirmed.' },
  doctor_assigned: { label: 'Doctor Assigned', desc: 'A physician has taken your case.' },
  doctor_reviewing: { label: 'Doctor Reviewing', desc: 'Your doctor is reading your history.' },
  doctor_contacting: { label: 'Doctor Contacting You', desc: 'Your doctor will reach out shortly.' },
  in_progress: { label: 'Consultation In Progress', desc: 'Your consultation is underway.' },
  prescription_ready: { label: 'Prescription Ready', desc: 'Your prescription is available.' },
  completed: { label: 'Completed', desc: 'This consultation is complete.' },
};

export function statusIndex(status: ConsultationStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/** A short chip label for lists / headers. */
export function statusChip(status: ConsultationStatus): string {
  return STATUS_META[status].label;
}
