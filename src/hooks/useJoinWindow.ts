import { useEffect, useState } from 'react';
import { evaluateJoinWindow } from '../lib/joinWindow';
import type { Consultation } from '../types/consultation';
import type { JoinWindow } from '../types/video';

const CLOSED: JoinWindow = { canJoin: false, reason: 'no_room', msUntilOpen: 0, opensAt: null };

/**
 * Live join-gate state for a consultation.
 *
 * Re-evaluates on a 1s tick only while a countdown is actually pending, so a
 * dashboard full of settled consultations does no repeating work at all. The
 * moment the window opens the interval clears itself.
 */
export function useJoinWindow(consultation: Consultation | null): JoinWindow {
  const [gate, setGate] = useState<JoinWindow>(() =>
    consultation ? evaluateJoinWindow(consultation) : CLOSED,
  );

  useEffect(() => {
    if (!consultation) {
      setGate(CLOSED);
      return;
    }

    const evaluate = (): JoinWindow => {
      const next = evaluateJoinWindow(consultation);
      setGate(next);
      return next;
    };

    // Only a pending countdown needs ticking; every other state is static until
    // the consultation document changes, which re-runs this effect anyway.
    if (evaluate().reason !== 'too_early') return;

    const id = setInterval(() => {
      if (evaluate().reason !== 'too_early') clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [consultation]);

  return gate;
}
