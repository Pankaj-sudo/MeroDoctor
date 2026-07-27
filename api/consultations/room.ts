import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ROOM_TTL_MINUTES } from '../../src/config/video.js';
import { authenticate, isStaff } from '../_lib/auth.js';
import {
  CONSULTATIONS,
  CONSULTATION_EVENTS,
  VIDEO_ROOMS,
  loadConsultation,
  loadRoom,
  mintRoomName,
} from '../_lib/consultations.js';
import { admin } from '../_lib/firebaseAdmin.js';
import { conflict, forbidden, requireMethod, requireString, sendJson, withErrorHandling } from '../_lib/http.js';
import { defaultProviderId, getRoomProvider } from '../_lib/providers/index.js';
import { isJoinableStatus } from '../../src/config/video.js';

// ============================================================================
// POST /api/consultations/room — provision the video room for a consultation.
//
// Called by the DOCTOR's "approve" action. Creates exactly one room per booking
// (document id === consultation id), so a duplicate request can never mint a
// second room. Patients cannot reach this endpoint at all.
// ============================================================================

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  requireMethod(req, 'POST');

  const user = await authenticate(req);
  // Only clinical staff provision rooms. A patient must never be able to
  // conjure a room for a consultation that has not been approved.
  if (!isStaff(user)) throw forbidden('Only the doctor can open a consultation room.');

  const consultationId = requireString(req.body, 'consultationId');
  const { db } = admin();
  const consultation = await loadConsultation(db, consultationId);

  if (!isJoinableStatus(consultation.status)) {
    throw conflict('Approve the consultation before opening its room.');
  }

  // Idempotent: if a live room already exists, hand back the same one rather
  // than creating a second room for the same booking.
  const existing = await loadRoom(db, consultationId);
  if (existing && existing.status !== 'ended' && existing.status !== 'expired') {
    sendJson(res, 200, {
      consultationId,
      provider: existing.provider,
      roomUrl: existing.roomUrl,
      status: existing.status,
      reused: true,
    });
    return;
  }

  const providerId = defaultProviderId();
  const provider = getRoomProvider(providerId);
  const roomName = mintRoomName(consultationId);
  const expiresAtMs = Date.now() + ROOM_TTL_MINUTES * 60_000;

  const roomRef = db.collection(VIDEO_ROOMS).doc(consultationId);
  const consultationRef = db.collection(CONSULTATIONS).doc(consultationId);

  let created;
  try {
    created = await provider.createRoom({ roomName, expiresAtMs, maxParticipants: 2 });
  } catch (err) {
    // Record the failure so the doctor sees "room creation failed" instead of a
    // button that silently does nothing, then rethrow for the JSON envelope.
    await roomRef.set(
      {
        consultationId,
        bookingId: consultationId,
        provider: providerId,
        status: 'failed',
        error: err instanceof Error ? err.message.slice(0, 500) : 'Room creation failed.',
        patientId: consultation.patientId,
        doctorId: user.uid,
        participantIds: [consultation.patientId, user.uid],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
      },
      { merge: true },
    );
    await consultationRef.update({
      videoRoomStatus: 'failed',
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw err;
  }

  const doctorId = consultation.assignedDoctorId || user.uid;
  const participantIds = [consultation.patientId, doctorId];

  const batch = db.batch();
  batch.set(roomRef, {
    consultationId,
    bookingId: consultationId,
    provider: providerId,
    roomId: created.roomId,
    roomName: created.roomName,
    roomUrl: created.roomUrl,
    doctorId,
    patientId: consultation.patientId,
    participantIds,
    status: 'created',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    startedAt: null,
    endedAt: null,
    createdBy: user.uid,
    // No `error` field: this is a full set() (not a merge), so it overwrites the
    // whole document and any error from a prior failed attempt is already gone.
    // (FieldValue.delete() is illegal in a plain set() and would crash the write.)
  });
  batch.update(consultationRef, {
    videoRoomId: consultationId,
    videoRoomStatus: 'created',
    videoProvider: providerId,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection(CONSULTATION_EVENTS).doc(), {
    consultationId,
    type: 'room_created',
    actorId: user.uid,
    actorRole: 'doctor',
    actorName: user.name,
    at: FieldValue.serverTimestamp(),
    participantIds,
  });
  await batch.commit();

  sendJson(res, 201, {
    consultationId,
    provider: providerId,
    roomUrl: created.roomUrl,
    status: 'created',
    reused: false,
  });
});
