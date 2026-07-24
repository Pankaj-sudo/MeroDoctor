import { useJoinWindow } from '../../hooks/useJoinWindow';
import { formatCountdown } from '../../lib/joinWindow';
import { isJoinableStatus } from '../../config/video';
import type { Consultation } from '../../types/consultation';

/**
 * Compact, non-interactive video status for dense list rows (the doctor queue,
 * the patient's consultation list). Shares the join gate with the real button,
 * so a row can never advertise "ready" while the room refuses to open.
 */
export function VideoStateBadge({ consultation }: { consultation: Consultation }) {
  const gate = useJoinWindow(consultation);

  // Nothing to say until the case is approved for a call.
  if (!isJoinableStatus(consultation.status)) return null;

  if (consultation.videoRoomStatus === 'active' && gate.canJoin) {
    return <span className="c-badge c-badge--green v-badge--live">● Call live</span>;
  }
  if (gate.canJoin) return <span className="c-badge c-badge--green">Ready to join</span>;
  if (gate.reason === 'too_early') {
    return <span className="c-badge c-badge--amber">{formatCountdown(gate.msUntilOpen)}</span>;
  }
  if (gate.reason === 'no_room') {
    return <span className="c-badge c-badge--amber">Room not open</span>;
  }
  return null;
}
