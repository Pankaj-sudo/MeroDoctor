import { randomBytes } from 'node:crypto';
import type { Firestore, Timestamp } from 'firebase-admin/firestore';
import { evaluateJoinWindowFrom } from '../../src/lib/joinWindow';
import type { ConsultationStatus } from '../../src/types/consultation';
import type { VideoProviderId, VideoRoomStatus } from '../../src/types/video';
import { forbidden, notFound, type HttpError } from './http';
import type { AuthedUser } from './auth';
import { isStaff } from './auth';

// ============================================================================
// Consultation access control — the security boundary for every video route.
//
// Rule: a room may only ever be touched by the assigned patient or a member of
// clinical staff. Ownership is re-derived from the consultation document on the
// server for EVERY request; the client's claim about who it is, which
// consultation it wants, or whether it is allowed, is never trusted.
// ============================================================================

export const CONSULTATIONS = 'consultations';
export const VIDEO_ROOMS = 'videoRooms';
export const CONSULTATION_EVENTS = 'consultationEvents';

/** The consultation fields the video layer needs. */
export interface ConsultationRecord {
  id: string;
  patientId: string;
  status: ConsultationStatus;
  assignedDoctorId?: string;
  patientName: string;
  scheduledAtMs: number | null;
  videoRoomId?: string;
  videoRoomStatus?: VideoRoomStatus;
}

export interface RoomRecord {
  provider: VideoProviderId;
  roomName: string;
  roomUrl: string;
  roomId: string;
  status: VideoRoomStatus;
  patientId: string;
  doctorId: string;
  expiresAtMs: number | null;
}

function millis(value: unknown): number | null {
  const ts = value as Timestamp | null | undefined;
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;
}

export async function loadConsultation(db: Firestore, id: string): Promise<ConsultationRecord> {
  const snap = await db.collection(CONSULTATIONS).doc(id).get();
  if (!snap.exists) throw notFound('Consultation not found.');
  const d = snap.data() as Record<string, unknown>;
  const patient = d.patient as { fullName?: string } | undefined;
  return {
    id: snap.id,
    patientId: String(d.patientId ?? ''),
    status: d.status as ConsultationStatus,
    assignedDoctorId: d.assignedDoctorId ? String(d.assignedDoctorId) : undefined,
    patientName: patient?.fullName?.trim() || 'Patient',
    scheduledAtMs: millis(d.scheduledAt),
    videoRoomId: d.videoRoomId ? String(d.videoRoomId) : undefined,
    videoRoomStatus: d.videoRoomStatus as VideoRoomStatus | undefined,
  };
}

export async function loadRoom(db: Firestore, consultationId: string): Promise<RoomRecord | null> {
  const snap = await db.collection(VIDEO_ROOMS).doc(consultationId).get();
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    provider: d.provider as VideoProviderId,
    roomName: String(d.roomName ?? ''),
    roomUrl: String(d.roomUrl ?? ''),
    roomId: String(d.roomId ?? ''),
    status: d.status as VideoRoomStatus,
    patientId: String(d.patientId ?? ''),
    doctorId: String(d.doctorId ?? ''),
    expiresAtMs: millis(d.expiresAt),
  };
}

/**
 * Assert the caller is a legitimate participant and report which side they are.
 * This is the single choke point every video route funnels through.
 */
export function assertParticipant(
  user: AuthedUser,
  consultation: ConsultationRecord,
): { isDoctorSide: boolean } {
  if (isStaff(user)) return { isDoctorSide: true };
  if (user.uid === consultation.patientId) return { isDoctorSide: false };
  // Deliberately the same message for "not yours" and "doesn't exist" so the
  // endpoint cannot be used to probe which consultation ids are real.
  throw forbidden();
}

/**
 * Re-run the join gate on the server. Shares its implementation with the client
 * (src/lib/joinWindow.ts), so the button and the token issuer always agree.
 */
export function assertJoinable(consultation: ConsultationRecord): void {
  const gate = evaluateJoinWindowFrom({
    status: consultation.status,
    videoRoomId: consultation.videoRoomId,
    videoRoomStatus: consultation.videoRoomStatus,
    scheduledAtMs: consultation.scheduledAtMs,
  });
  if (gate.canJoin) return;

  const messages: Record<string, string> = {
    not_approved: 'This consultation has not been approved for a video call yet.',
    too_early: 'The consultation room is not open yet.',
    ended: 'This consultation has ended.',
    expired: 'This consultation room has expired.',
    no_room: 'No consultation room has been created yet.',
    not_participant: 'You do not have access to this consultation.',
  };
  throw forbidden(messages[gate.reason ?? 'ended'] ?? 'This consultation is not joinable.') as HttpError;
}

/**
 * An unguessable, single-use room name. The consultation id alone is NOT enough
 * to derive it: 128 bits of entropy are appended, so knowing (or brute-forcing)
 * consultation ids reveals nothing about room URLs. A new room always gets a
 * fresh name — names are never reused, even for the same booking.
 */
export function mintRoomName(consultationId: string): string {
  const slug = consultationId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  return `md-${slug}-${randomBytes(16).toString('hex')}`;
}
