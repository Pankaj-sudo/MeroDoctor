import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { JOIN_TOKEN_TTL_MINUTES } from '../../src/config/video';
import { authenticate } from '../_lib/auth';
import {
  CONSULTATIONS,
  VIDEO_ROOMS,
  assertJoinable,
  assertParticipant,
  loadConsultation,
  loadRoom,
} from '../_lib/consultations';
import { admin } from '../_lib/firebaseAdmin';
import { forbidden, notFound, requireMethod, requireString, sendJson, withErrorHandling } from '../_lib/http';
import { getRoomProvider } from '../_lib/providers';

// ============================================================================
// POST /api/consultations/join — mint a short-lived join credential.
//
// This is the endpoint that actually enforces "only the assigned patient and
// the assigned doctor may join". Rooms are PRIVATE at the provider, so the room
// URL is worthless without one of these tokens. Every request re-verifies:
//   1. the Firebase ID token (identity)
//   2. participation in this specific consultation (ownership)
//   3. the join window + room lifecycle (timing)
// Tokens are never stored — they are minted per request and expire quickly.
// ============================================================================

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  requireMethod(req, 'POST');

  const user = await authenticate(req);
  const consultationId = requireString(req.body, 'consultationId');

  const { db } = admin();
  const consultation = await loadConsultation(db, consultationId);

  // (2) ownership — throws 403 for anyone who is neither the patient nor staff.
  const { isDoctorSide } = assertParticipant(user, consultation);
  // (3) timing + lifecycle — same gate the client used to render the button.
  assertJoinable(consultation);

  const room = await loadRoom(db, consultationId);
  if (!room) throw notFound('No consultation room has been created yet.');
  if (room.status === 'ended') throw forbidden('This consultation has ended.');
  if (room.expiresAtMs !== null && room.expiresAtMs <= Date.now()) {
    // Reflect the expiry so the UI stops offering a dead room.
    await db.collection(VIDEO_ROOMS).doc(consultationId).update({ status: 'expired' });
    await db.collection(CONSULTATIONS).doc(consultationId).update({
      videoRoomStatus: 'expired',
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw forbidden('This consultation room has expired.');
  }

  // A patient must be THE patient on this booking, even if some other document
  // drifted — belt and braces over assertParticipant.
  if (!isDoctorSide && user.uid !== room.patientId) throw forbidden();

  const expiresAtMs = Date.now() + JOIN_TOKEN_TTL_MINUTES * 60_000;
  const provider = getRoomProvider(room.provider);
  const token = await provider.issueToken({
    roomName: room.roomName,
    userId: user.uid,
    // The doctor sees the patient's real name; the patient sees the clinician.
    userName: isDoctorSide ? user.name : consultation.patientName,
    isOwner: isDoctorSide,
    // Screen sharing is a doctor-side capability (sharing results, imaging).
    canScreenShare: isDoctorSide,
    expiresAtMs,
  });

  // First join flips the room to active and stamps the clinical start time.
  if (room.status === 'created') {
    await db.collection(VIDEO_ROOMS).doc(consultationId).update({
      status: 'active',
      startedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(CONSULTATIONS).doc(consultationId).update({
      videoRoomStatus: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  sendJson(res, 200, {
    provider: room.provider,
    roomUrl: room.roomUrl,
    roomName: room.roomName,
    token,
    userName: isDoctorSide ? user.name : consultation.patientName,
    canScreenShare: isDoctorSide,
    expiresAtMs,
  });
});
