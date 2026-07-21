import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { Consultation, ConsultationDraft, PaymentInfo } from '../types/consultation';

const COLLECTION = 'consultations';

/** Upload the eSewa payment screenshot to Storage; returns its download URL. */
export async function uploadPaymentScreenshot(uid: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]/g, '_');
  const path = `payment-screenshots/${uid}/${Date.now()}-${safe}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return getDownloadURL(ref(storage, path));
}

/**
 * Create the consultation document. It starts at `payment_pending` — the
 * payment is recorded as `pending_verification` and is NEVER auto-approved; a
 * doctor/admin verifies it out of band.
 */
export async function createConsultation(
  uid: string,
  draft: ConsultationDraft,
  payment: PaymentInfo,
): Promise<string> {
  const stamp = Timestamp.now(); // array entries can't use serverTimestamp()
  const docRef = await addDoc(collection(db, COLLECTION), {
    patientId: uid,
    patient: draft.patient,
    symptoms: draft.symptoms,
    customComplaint: draft.customComplaint,
    answers: draft.answers,
    history: draft.history,
    payment,
    status: 'payment_pending',
    statusHistory: [
      { status: 'submitted', at: stamp },
      { status: 'payment_pending', at: stamp },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Live-subscribe to one consultation (real-time status tracking). */
export function subscribeConsultation(
  id: string,
  cb: (c: Consultation | null) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTION, id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Consultation) : null),
    (err) => {
      console.error('[consultation] subscribe error', err);
      onError?.(err);
    },
  );
}

/**
 * Live-subscribe to the signed-in patient's consultations, newest first.
 * Filtered by owner only (no composite index needed) and sorted client-side.
 */
export function subscribePatientConsultations(
  uid: string,
  cb: (list: Consultation[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('patientId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Consultation);
      list.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      cb(list);
    },
    (err) => {
      console.error('[consultation] list error', err);
      onError?.(err);
    },
  );
}
