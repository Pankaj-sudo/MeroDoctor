import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJoinWindow } from '../../hooks/useJoinWindow';
import { JOIN_BLOCK_COPY, formatCountdown } from '../../lib/joinWindow';
import { createConsultationRoom } from '../../services/videoRoomService';
import { ApiError } from '../../lib/apiClient';
import type { Consultation } from '../../types/consultation';

/**
 * The single place the "can I join yet?" affordance is rendered — used by both
 * the patient and doctor dashboards so the two can never disagree.
 *
 *  • window open              → Join button (routes to the consultation room)
 *  • scheduled, not yet open  → live countdown ("Available in 13 minutes")
 *  • approved, no room yet    → doctor sees "Open room"; patient sees a note
 *  • ended / expired          → a plain status line, no button
 */
export function JoinConsultationButton({
  consultation,
  isDoctorSide,
  className = '',
}: {
  consultation: Consultation;
  isDoctorSide: boolean;
  className?: string;
}) {
  const gate = useJoinWindow(consultation);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      await createConsultationRoom(consultation.id);
      // The consultation subscription pushes videoRoomId/Status back down, which
      // re-renders this component into its "join" state — no local state needed.
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not open the room. Please try again.',
      );
    } finally {
      setCreating(false);
    }
  };

  if (gate.canJoin) {
    return (
      <div className={`v-join ${className}`}>
        <Link className="v-join__btn" to={`/consultation/${consultation.id}/room`}>
          Join consultation
        </Link>
      </div>
    );
  }

  if (gate.reason === 'too_early') {
    return (
      <div className={`v-join ${className}`}>
        <span className="v-join__wait">
          <strong>{formatCountdown(gate.msUntilOpen)}</strong>
        </span>
        {gate.opensAt ? (
          <p className="v-join__note">
            Opens at{' '}
            {gate.opensAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        ) : null}
      </div>
    );
  }

  // Approved but no room yet: the doctor is the one who provisions it.
  if (gate.reason === 'no_room') {
    if (!isDoctorSide) {
      return (
        <div className={`v-join ${className}`}>
          <span className="v-join__wait">Your doctor is opening the room…</span>
        </div>
      );
    }
    return (
      <div className={`v-join ${className}`}>
        <button type="button" className="v-join__btn" onClick={() => void openRoom()} disabled={creating}>
          {creating ? 'Opening room…' : 'Open video room'}
        </button>
        {error ? <p className="v-join__err">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={`v-join ${className}`}>
      <span className="v-join__wait">{JOIN_BLOCK_COPY[gate.reason ?? 'no_room']}</span>
    </div>
  );
}
