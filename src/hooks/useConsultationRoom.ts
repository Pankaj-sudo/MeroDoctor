import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeConsultation } from '../services/consultationService';
import { subscribeVideoRoom } from '../services/videoRoomService';
import type { Consultation } from '../types/consultation';
import type { ChatSenderRole, VideoRoom } from '../types/video';

export interface UseConsultationRoom {
  consultation: Consultation | null;
  room: VideoRoom | null;
  loading: boolean;
  /** Set when the consultation is missing or unreadable for this user. */
  error: string | null;
  /** True for the doctor/admin/clinic-staff side of the call. */
  isDoctorSide: boolean;
  /** The signed-in user's chat/event role. */
  role: ChatSenderRole;
  /** [patientId, doctorId] — stamped onto chat messages and events. */
  participantIds: string[];
  /** False when the signed-in user is neither the patient nor staff. */
  isParticipant: boolean;
}

/**
 * Subscribes to both halves of a video consultation (the consultation document
 * and its room) and derives which side of the call the viewer is on.
 *
 * The `isParticipant` result is a UI convenience only — the serverless API
 * re-derives it from the verified token before minting any join token, so a
 * user who forces their way to this page still cannot join.
 */
export function useConsultationRoom(consultationId: string | undefined): UseConsultationRoom {
  const { user, role: authRole } = useAuth();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [room, setRoom] = useState<VideoRoom | null>(null);
  const [loadingConsultation, setLoadingConsultation] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDoctorSide =
    authRole === 'doctor' || authRole === 'admin' || authRole === 'clinic_staff';

  useEffect(() => {
    if (!consultationId) {
      setLoadingConsultation(false);
      setError('No consultation was specified.');
      return;
    }
    setLoadingConsultation(true);
    const unsubscribe = subscribeConsultation(
      consultationId,
      (c) => {
        setConsultation(c);
        setLoadingConsultation(false);
        setError(c ? null : 'This consultation could not be found.');
      },
      () => {
        setLoadingConsultation(false);
        setError('You do not have access to this consultation.');
      },
    );
    return unsubscribe;
  }, [consultationId]);

  useEffect(() => {
    if (!consultationId) return;
    // A missing room is a normal state (not yet approved), so failures here are
    // silent: the join gate already explains why there is nothing to join.
    return subscribeVideoRoom(consultationId, setRoom, () => setRoom(null));
  }, [consultationId]);

  const participantIds = useMemo(() => {
    if (room) return room.participantIds;
    if (!consultation) return [];
    // Before a room exists, fall back to the consultation's own two sides.
    const doctorId = consultation.assignedDoctorId ?? user?.uid ?? '';
    return [consultation.patientId, doctorId].filter(Boolean);
  }, [room, consultation, user?.uid]);

  const isParticipant = Boolean(
    consultation && user && (isDoctorSide || consultation.patientId === user.uid),
  );

  return {
    consultation,
    room,
    loading: loadingConsultation,
    error,
    isDoctorSide,
    role: isDoctorSide ? 'doctor' : 'patient',
    participantIds,
    isParticipant,
  };
}
