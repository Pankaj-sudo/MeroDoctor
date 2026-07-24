import type { JoinGrant, VideoProviderId } from '../../types/video';

// ============================================================================
// CallSession — the client-side half of the video abstraction.
//
// Components and hooks never import a vendor SDK. They talk to this interface,
// which exposes only what a medical consultation needs: join, leave, mute,
// camera, screen share, and a stream of participant/connection/quality events.
// Swapping Daily for LiveKit/Agora/Twilio means writing one adapter file.
// ============================================================================

/** A participant as the UI needs to render them, vendor-neutral. */
export interface CallParticipant {
  /** Stable per-session id from the provider. */
  sessionId: string;
  /** Firebase uid, when the provider carries it on the token. */
  userId: string | null;
  name: string;
  isLocal: boolean;
  audioOn: boolean;
  videoOn: boolean;
  screenOn: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  screenVideoTrack: MediaStreamTrack | null;
}

export type CallConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

/** Coarse network quality — enough to warn a clinician, not a telemetry tool. */
export type CallQuality = 'good' | 'low' | 'very-low' | 'unknown';

/**
 * Every failure mode the UI has a designed screen for. Anything unexpected
 * collapses to 'unknown', which renders the generic (still elegant) error.
 */
export type CallErrorKind =
  | 'camera_unavailable'
  | 'microphone_unavailable'
  | 'permission_denied'
  | 'device_in_use'
  | 'network_lost'
  | 'provider_timeout'
  | 'room_expired'
  | 'not_allowed'
  | 'unknown';

export interface CallError {
  kind: CallErrorKind;
  message: string;
  /** True when retrying could plausibly succeed (network blips, timeouts). */
  recoverable: boolean;
}

/** Callbacks the session pushes state through. All optional. */
export interface CallSessionHandlers {
  onParticipants?: (participants: CallParticipant[]) => void;
  onConnectionState?: (state: CallConnectionState) => void;
  onQuality?: (quality: CallQuality) => void;
  onError?: (error: CallError) => void;
  /** Fired when the local user is removed by the provider (room expiry/eject). */
  onEjected?: () => void;
}

export interface CallSession {
  join(grant: JoinGrant): Promise<void>;
  leave(): Promise<void>;
  setMicrophone(on: boolean): Promise<void>;
  setCamera(on: boolean): Promise<void>;
  setScreenShare(on: boolean): Promise<void>;
  /** Release the SDK, all media tracks and every listener. Idempotent. */
  destroy(): Promise<void>;
}

/**
 * A provider factory. `createSession` is async because the adapter lazy-loads
 * its SDK — no vendor bytes are downloaded until a consultation is joined.
 */
export interface VideoClientProvider {
  readonly id: VideoProviderId;
  createSession(handlers: CallSessionHandlers): Promise<CallSession>;
}
