import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticate, isStaff } from '../_lib/auth';
import {
  CONSULTATIONS,
  CONSULTATION_EVENTS,
  VIDEO_ROOMS,
  loadConsultation,
  loadRoom,
} from '../_lib/consultations';
import { admin } from '../_lib/firebaseAdmin';
import { forbidden, requireMethod, requireString, sendJson, withErrorHandling } from '../_lib/http';
import { getRoomProvider } from '../_lib/providers';

// ============================================================================
// POST /api/consultations/end — close the room for good.
//
// Doctor-only. Deletes the room at the provider (so no outstanding token can be
// replayed) and marks it ended locally, which permanently closes the join gate.
// Room names are never reused, so a future consultation cannot inherit access.
// ============================================================================

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  requireMethod(req, 'POST');

  const user = await authenticate(req);
  if (!isStaff(user)) throw forbidden('Only the doctor can end a consultation.');

  const consultationId = requireString(req.body, 'consultationId');
  const { db } = admin();
  const consultation = await loadConsultation(db, consultationId);
  const room = await loadRoom(db, consultationId);

  if (room && room.status !== 'ended') {
    // Tearing the room down at the provider is what actually revokes access:
    // any still-valid meeting token now points at a room that no longer exists.
    try {
      await getRoomProvider(room.provider).deleteRoom(room.roomName);
    } catch (err) {
      // A provider outage must not block ending the consultation clinically —
      // the local `ended` status already closes our join gate.
      console.error('[api] provider room teardown failed; ending locally', err);
    }
  }

  const participantIds = [consultation.patientId, room?.doctorId ?? user.uid];
  const batch = db.batch();

  if (room) {
    batch.update(db.collection(VIDEO_ROOMS).doc(consultationId), {
      status: 'ended',
      endedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(db.collection(CONSULTATIONS).doc(consultationId), {
    videoRoomStatus: 'ended',
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection(CONSULTATION_EVENTS).doc(), {
    consultationId,
    type: 'consultation_ended',
    actorId: user.uid,
    actorRole: 'doctor',
    actorName: user.name,
    at: FieldValue.serverTimestamp(),
    participantIds,
  });
  await batch.commit();

  sendJson(res, 200, { consultationId, status: 'ended' });
});
