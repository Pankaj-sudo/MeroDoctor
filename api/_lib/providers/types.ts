import type { VideoProviderId } from '../../../src/types/video.js';

// ============================================================================
// RoomProvider — the server-side half of the video abstraction.
//
// Everything that needs the provider's SECRET API key lives behind this
// interface: creating rooms, minting per-user join tokens, tearing rooms down.
// The app only ever talks to this interface, so adding Zoom / LiveKit / Agora /
// Twilio / Meet means writing one new file that implements it and registering
// it in ./index.ts — no route, service, hook or component changes.
// ============================================================================

export interface CreateRoomInput {
  /** Unguessable slug we generate; the provider must use it verbatim. */
  roomName: string;
  /** Hard expiry the PROVIDER enforces, so a stale tab cannot rejoin forever. */
  expiresAtMs: number;
  /** A consultation is 1:1 — a third joiner is a security failure, not a feature. */
  maxParticipants: number;
}

export interface CreatedRoom {
  roomId: string;
  roomName: string;
  roomUrl: string;
}

export interface IssueTokenInput {
  roomName: string;
  /** Firebase uid — binds the token to one identity. */
  userId: string;
  userName: string;
  /** Doctors are room owners (may eject, may share screen). */
  isOwner: boolean;
  canScreenShare: boolean;
  expiresAtMs: number;
}

export interface RoomProvider {
  readonly id: VideoProviderId;
  createRoom(input: CreateRoomInput): Promise<CreatedRoom>;
  /** Mint a short-lived credential scoped to one room AND one identity. */
  issueToken(input: IssueTokenInput): Promise<string>;
  /** Best-effort teardown; must not throw if the room is already gone. */
  deleteRoom(roomName: string): Promise<void>;
}

/** Thrown for provider-side failures so routes can map them to clean HTTP. */
export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}
