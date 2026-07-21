import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  ActivityLog,
  Clinical,
  Consultation,
  ConsultationStatus,
} from '../types/consultation';

export interface Actor {
  uid: string;
  name: string;
}

const CONSULTATIONS = 'consultations';
const ACTIVITY = 'activity_logs';

/** Append an audit-trail entry. Called by every doctor action. */
export async function logActivity(
  consultationId: string,
  actor: Actor,
  action: string,
  detail = '',
): Promise<void> {
  await addDoc(collection(db, ACTIVITY), {
    consultationId,
    actorId: actor.uid,
    actorName: actor.name,
    action,
    detail,
    at: serverTimestamp(),
  });
}

interface Transition {
  status?: ConsultationStatus;
  action: string;
  detail?: string;
  fields?: Record<string, unknown>;
}

/** Update a consultation + (optionally) advance its status + write an audit log. */
async function transition(id: string, actor: Actor, t: Transition): Promise<void> {
  const patch: Record<string, unknown> = { ...(t.fields ?? {}), updatedAt: serverTimestamp() };
  if (t.status) {
    patch.status = t.status;
    patch.statusHistory = arrayUnion({ status: t.status, at: Timestamp.now() });
  }
  await updateDoc(doc(db, CONSULTATIONS, id), patch);
  await logActivity(id, actor, t.action, t.detail ?? '');
}

// ---- payment ----
export function verifyPayment(id: string, actor: Actor): Promise<void> {
  return transition(id, actor, {
    status: 'payment_verified',
    action: 'Verified payment',
    fields: {
      'payment.status': 'verified',
      paymentReviewedBy: actor.uid,
      paymentReviewedAt: serverTimestamp(),
    },
  });
}

export function rejectPayment(id: string, actor: Actor, note: string): Promise<void> {
  return transition(id, actor, {
    action: 'Rejected payment',
    detail: note,
    fields: {
      'payment.status': 'rejected',
      paymentNote: note,
      paymentReviewedBy: actor.uid,
      paymentReviewedAt: serverTimestamp(),
    },
  });
}

export function requestNewScreenshot(id: string, actor: Actor, note: string): Promise<void> {
  return transition(id, actor, {
    action: 'Requested a new payment screenshot',
    detail: note,
    fields: { 'payment.status': 'pending_verification', paymentNote: note },
  });
}

// ---- workflow ----
export function assignToMe(id: string, actor: Actor): Promise<void> {
  return transition(id, actor, {
    status: 'doctor_assigned',
    action: 'Assigned consultation to self',
    fields: { assignedDoctorId: actor.uid, assignedDoctorName: actor.name },
  });
}

export function advanceStatus(
  id: string,
  actor: Actor,
  status: ConsultationStatus,
  action: string,
): Promise<void> {
  return transition(id, actor, { status, action });
}

export function markCompleted(id: string, actor: Actor): Promise<void> {
  return transition(id, actor, { status: 'completed', action: 'Marked consultation completed' });
}

// ---- clinical documentation ----
export function saveClinical(id: string, actor: Actor, clinical: Clinical): Promise<void> {
  return transition(id, actor, { action: 'Saved clinical notes', fields: { clinical } });
}

/** Save clinical notes and mark the prescription ready (patient can view it). */
export function publishPrescription(id: string, actor: Actor, clinical: Clinical): Promise<void> {
  return transition(id, actor, {
    status: 'prescription_ready',
    action: 'Published prescription',
    fields: { clinical },
  });
}

// ---- subscriptions ----
/** Live-subscribe to every consultation, newest first (doctor queue + stats). */
export function subscribeAllConsultations(
  cb: (list: Consultation[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, CONSULTATIONS), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Consultation)),
    (err) => {
      console.error('[doctor] queue error', err);
      onError?.(err);
    },
  );
}

/** Live-subscribe to one consultation's audit trail, newest first. */
export function subscribeActivity(
  consultationId: string,
  cb: (list: ActivityLog[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, ACTIVITY), where('consultationId', '==', consultationId)),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityLog);
      list.sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0));
      cb(list);
    },
    (err) => console.error('[doctor] activity error', err),
  );
}
