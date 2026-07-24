import { useCallback, useEffect, useRef, useState } from 'react';
import { getVideoClientProvider } from '../services/video';
import type {
  CallConnectionState,
  CallError,
  CallParticipant,
  CallQuality,
  CallSession,
} from '../services/video/types';
import { requestJoinGrant } from '../services/videoRoomService';
import { ApiError } from '../lib/apiClient';
import type { VideoProviderId } from '../types/video';

// ============================================================================
// useCallSession — owns the entire lifetime of one video consultation.
//
// Responsibilities:
//   • fetch a fresh join grant, lazy-load the provider SDK, join
//   • surface participants / connection / quality / errors as React state
//   • expose mic, camera and screen-share controls
//   • guarantee teardown: every exit path destroys the session, releasing the
//     camera and microphone. This is why the camera light goes out reliably.
// ============================================================================

export type CallPhase = 'idle' | 'preparing' | 'joining' | 'live' | 'ended' | 'error';

export interface UseCallSession {
  phase: CallPhase;
  connection: CallConnectionState;
  quality: CallQuality;
  error: CallError | null;
  participants: CallParticipant[];
  local: CallParticipant | null;
  remote: CallParticipant | null;
  micOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  /** Epoch ms of the moment the call connected; null until then. */
  startedAtMs: number | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  /** Clear the error and allow another join attempt. */
  retry: () => void;
}

function toCallError(err: unknown): CallError {
  if (err instanceof ApiError) {
    // The API already produced human copy; map its code to a UI failure mode.
    const kind =
      err.code === 'forbidden' || err.code === 'unauthenticated'
        ? 'not_allowed'
        : err.code === 'not_found'
          ? 'room_expired'
          : err.code === 'network_error'
            ? 'network_lost'
            : 'unknown';
    return { kind, message: err.message, recoverable: kind === 'network_lost' };
  }
  return {
    kind: 'unknown',
    message: err instanceof Error ? err.message : 'The consultation could not be started.',
    recoverable: true,
  };
}

export function useCallSession(
  consultationId: string,
  provider: VideoProviderId | undefined,
): UseCallSession {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [connection, setConnection] = useState<CallConnectionState>('idle');
  const [quality, setQuality] = useState<CallQuality>('unknown');
  const [error, setError] = useState<CallError | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  const sessionRef = useRef<CallSession | null>(null);
  // Guards every async continuation: once unmounted we must not touch state,
  // and we must not leave a half-created session holding the camera.
  const aliveRef = useRef(true);
  const joiningRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const session = sessionRef.current;
      sessionRef.current = null;
      // Fire-and-forget on unmount — React cannot await this, but destroy()
      // is what releases the media tracks, so it must always run.
      void session?.destroy();
    };
  }, []);

  const join = useCallback(async () => {
    if (joiningRef.current || sessionRef.current) return;
    joiningRef.current = true;
    setError(null);
    setPhase('preparing');

    try {
      // 1. Ask the server for permission + a short-lived credential. This is
      //    the authorisation checkpoint; it throws 403 for non-participants.
      const grant = await requestJoinGrant(consultationId);
      if (!aliveRef.current) return;

      // 2. Lazy-load the adapter for the provider that owns THIS room.
      const clientProvider = await getVideoClientProvider(grant.provider ?? provider);
      if (!aliveRef.current) return;

      const session = await clientProvider.createSession({
        onParticipants: (list) => {
          if (!aliveRef.current) return;
          setParticipants(list);
          const localSelf = list.find((p) => p.isLocal);
          if (localSelf) {
            setMicOn(localSelf.audioOn);
            setCameraOn(localSelf.videoOn);
            setScreenOn(localSelf.screenOn);
          }
        },
        onConnectionState: (state) => {
          if (!aliveRef.current) return;
          setConnection(state);
          if (state === 'connected') {
            setPhase('live');
            setStartedAtMs((prev) => prev ?? Date.now());
          }
        },
        onQuality: (q) => aliveRef.current && setQuality(q),
        onError: (e) => {
          if (!aliveRef.current) return;
          setError(e);
          // A recoverable blip keeps the call on screen; a fatal error replaces it.
          if (!e.recoverable) setPhase('error');
        },
        onEjected: () => {
          if (!aliveRef.current) return;
          setPhase('ended');
        },
      });

      if (!aliveRef.current) {
        // Unmounted while the SDK was loading — never leave it holding devices.
        void session.destroy();
        return;
      }

      sessionRef.current = session;
      setPhase('joining');
      await session.join(grant);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(toCallError(err));
      setPhase('error');
      const session = sessionRef.current;
      sessionRef.current = null;
      void session?.destroy();
    } finally {
      joiningRef.current = false;
    }
  }, [consultationId, provider]);

  const leave = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setPhase('ended');
    setConnection('disconnected');
    setParticipants([]);
    await session?.destroy();
  }, []);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      const next = !on;
      void sessionRef.current?.setMicrophone(next);
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOn((on) => {
      const next = !on;
      void sessionRef.current?.setCamera(next);
      return next;
    });
  }, []);

  const toggleScreenShare = useCallback(() => {
    setScreenOn((on) => {
      const next = !on;
      void sessionRef.current?.setScreenShare(next);
      return next;
    });
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setPhase('idle');
  }, []);

  const local = participants.find((p) => p.isLocal) ?? null;
  const remote = participants.find((p) => !p.isLocal) ?? null;

  return {
    phase,
    connection,
    quality,
    error,
    participants,
    local,
    remote,
    micOn,
    cameraOn,
    screenOn,
    startedAtMs,
    join,
    leave,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    retry,
  };
}
