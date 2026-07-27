import type {
  DailyCall,
  DailyEventObjectFatalError,
  DailyEventObjectNetworkConnectionEvent,
  DailyEventObjectNetworkQualityEvent,
  DailyEventObjectNoPayload,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
  DailyParticipant,
} from '@daily-co/daily-js';
import type { JoinGrant } from '../../types/video';
import type {
  CallError,
  CallErrorKind,
  CallParticipant,
  CallSession,
  CallSessionHandlers,
  VideoClientProvider,
} from './types';

// ============================================================================
// Daily.co adapter.
//
// Runs in "call object" mode (no vendor iframe) so the consultation UI is
// entirely ours and matches MeroDoctor's design language. The SDK is imported
// dynamically — it is NOT in the main bundle and is only fetched when a
// participant actually joins a call.
// ============================================================================

/** Map Daily's error strings onto the failure modes the UI has screens for. */
function classifyError(message: string): CallErrorKind {
  const m = message.toLowerCase();
  if (m.includes('permission') || m.includes('denied') || m.includes('notallowed')) {
    return 'permission_denied';
  }
  if (m.includes('camera') || m.includes('video')) return 'camera_unavailable';
  if (m.includes('microphone') || m.includes('audio') || m.includes('mic')) {
    return 'microphone_unavailable';
  }
  if (m.includes('in use') || m.includes('notreadable')) return 'device_in_use';
  if (m.includes('expired') || m.includes('exp')) return 'room_expired';
  if (m.includes('not allowed') || m.includes('rejected') || m.includes('unauthorized')) {
    return 'not_allowed';
  }
  if (m.includes('timeout')) return 'provider_timeout';
  if (m.includes('network') || m.includes('connection')) return 'network_lost';
  return 'unknown';
}

const RECOVERABLE: ReadonlySet<CallErrorKind> = new Set<CallErrorKind>([
  'network_lost',
  'provider_timeout',
]);

function toCallError(message: string): CallError {
  const kind = classifyError(message);
  return { kind, message, recoverable: RECOVERABLE.has(kind) };
}

/** Read a track off a Daily participant, tolerating SDK shape differences. */
function trackOf(p: DailyParticipant, key: 'video' | 'audio' | 'screenVideo'): MediaStreamTrack | null {
  const entry = p.tracks?.[key];
  if (!entry) return null;
  // `persistentTrack` survives brief mute/unmute cycles; `track` is the live one.
  return entry.persistentTrack ?? entry.track ?? null;
}

function toParticipant(p: DailyParticipant): CallParticipant {
  return {
    sessionId: p.session_id,
    userId: p.user_id ?? null,
    name: p.user_name || 'Participant',
    isLocal: p.local,
    audioOn: Boolean(p.audio),
    videoOn: Boolean(p.video),
    screenOn: Boolean(p.screen),
    videoTrack: trackOf(p, 'video'),
    audioTrack: trackOf(p, 'audio'),
    screenVideoTrack: trackOf(p, 'screenVideo'),
  };
}

export const dailyClientProvider: VideoClientProvider = {
  id: 'daily',

  async createSession(handlers: CallSessionHandlers): Promise<CallSession> {
    // Lazy: this dynamic import is what keeps the SDK out of the main bundle.
    const { default: DailyIframe } = await import('@daily-co/daily-js');

    // A second call object on the same page throws in Daily; reuse defensively
    // (React 18 StrictMode double-invokes effects in development).
    const existing = DailyIframe.getCallInstance();
    const call: DailyCall = existing ?? DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });

    let destroyed = false;

    const emitParticipants = () => {
      if (destroyed) return;
      const all = Object.values(call.participants()) as DailyParticipant[];
      handlers.onParticipants?.(all.map(toParticipant));
    };

    const onJoined = () => {
      handlers.onConnectionState?.('connected');
      emitParticipants();
    };
    const onLeft = (_e?: DailyEventObjectNoPayload) => {
      handlers.onConnectionState?.('disconnected');
    };
    const onParticipantChange = (
      _e?: DailyEventObjectParticipant | DailyEventObjectParticipantLeft,
    ) => emitParticipants();

    const onError = (e?: DailyEventObjectFatalError) => {
      const message = e?.errorMsg ?? 'The video connection failed.';
      handlers.onError?.(toCallError(message));
      handlers.onConnectionState?.('disconnected');
    };
    // Non-fatal device problems (camera busy, permission refused mid-call).
    const onDeviceError = (e?: { errorMsg?: { errorMsg?: string } | string }) => {
      const raw = typeof e?.errorMsg === 'string' ? e.errorMsg : e?.errorMsg?.errorMsg;
      handlers.onError?.(toCallError(raw ?? 'A camera or microphone problem occurred.'));
    };

    const onQuality = (e?: DailyEventObjectNetworkQualityEvent) => {
      const t = e?.threshold;
      handlers.onQuality?.(t === 'good' || t === 'low' || t === 'very-low' ? t : 'unknown');
    };

    /**
     * Daily's canonical reconnection signal. `interrupted` means the transport
     * dropped and the SDK is retrying — surfacing it as 'reconnecting' is what
     * drives the "Reconnecting…" chip instead of a silently frozen call.
     */
    const onNetworkConnection = (e?: DailyEventObjectNetworkConnectionEvent) => {
      if (e?.event === 'interrupted') handlers.onConnectionState?.('reconnecting');
      else if (e?.event === 'connected') handlers.onConnectionState?.('connected');
    };

    call
      .on('joined-meeting', onJoined)
      .on('left-meeting', onLeft)
      .on('participant-joined', onParticipantChange)
      .on('participant-updated', onParticipantChange)
      .on('participant-left', onParticipantChange)
      .on('error', onError)
      .on('camera-error', onDeviceError)
      .on('network-quality-change', onQuality)
      .on('network-connection', onNetworkConnection);

    // The room expired or the doctor ended it — the provider evicted us. Not
    // present in every SDK minor, so attach defensively rather than assuming.
    try {
      (call as unknown as { on: (e: string, f: () => void) => void }).on('ejected', () => {
        handlers.onEjected?.();
        handlers.onConnectionState?.('disconnected');
      });
    } catch {
      /* older SDK: room expiry still surfaces via the 'error' handler above */
    }

    return {
      async join(grant: JoinGrant) {
        handlers.onConnectionState?.('connecting');
        try {
          await call.join({ url: grant.roomUrl, token: grant.token, userName: grant.userName });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          handlers.onError?.(toCallError(message));
          handlers.onConnectionState?.('disconnected');
          throw err;
        }
      },

      async leave() {
        try {
          await call.leave();
        } catch {
          /* already gone — leaving twice is not an error worth surfacing */
        }
      },

      async setMicrophone(on: boolean) {
        call.setLocalAudio(on);
      },

      async setCamera(on: boolean) {
        call.setLocalVideo(on);
      },

      async setScreenShare(on: boolean) {
        if (on) call.startScreenShare();
        else call.stopScreenShare();
      },

      async destroy() {
        if (destroyed) return;
        destroyed = true;
        try {
          await call.leave();
        } catch {
          /* not joined */
        }
        try {
          // Releases every MediaStreamTrack the SDK holds — this is what stops
          // the camera light staying on after the consultation ends.
          await call.destroy();
        } catch {
          /* already destroyed */
        }
      },
    };
  },
};
