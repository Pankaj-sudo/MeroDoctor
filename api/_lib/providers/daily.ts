import { ProviderError } from './types';
import type { CreateRoomInput, CreatedRoom, IssueTokenInput, RoomProvider } from './types';

// ============================================================================
// Daily.co implementation of RoomProvider.
//
// Uses the REST API directly (no SDK) so the serverless bundle stays tiny and
// there is no transitive dependency to keep patched. The API key is read from
// the environment at call time and NEVER leaves this module.
// ============================================================================

const DAILY_API = 'https://api.daily.co/v1';

/** Daily expects expiry as whole seconds since the epoch. */
function toExpSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

async function dailyFetch<T>(
  apiKey: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${DAILY_API}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (cause) {
    // Network-level failure: Daily unreachable, DNS, TLS, timeout.
    throw new ProviderError(`Could not reach the video provider: ${String(cause)}`, 503);
  }

  if (res.status === 404) {
    throw new ProviderError('Room not found at the video provider.', 404);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // 401/403 from Daily means OUR key is wrong — that is a 500 for the caller,
    // never a 401, so we don't imply the end user's session is the problem.
    const status = res.status === 401 || res.status === 403 ? 500 : 502;
    throw new ProviderError(`Video provider error (${res.status}): ${detail.slice(0, 300)}`, status);
  }
  return (await res.json()) as T;
}

interface DailyRoomResponse {
  id: string;
  name: string;
  url: string;
}

interface DailyTokenResponse {
  token: string;
}

export function createDailyProvider(apiKey: string): RoomProvider {
  return {
    id: 'daily',

    async createRoom(input: CreateRoomInput): Promise<CreatedRoom> {
      const room = await dailyFetch<DailyRoomResponse>(apiKey, '/rooms', {
        method: 'POST',
        body: {
          name: input.roomName,
          // `private` is the whole anti-URL-guessing story: even with the exact
          // room URL, a participant without a server-minted token is refused.
          privacy: 'private',
          properties: {
            exp: toExpSeconds(input.expiresAtMs),
            // Kick everyone out when the room expires, rather than letting an
            // open tab linger in a room that should no longer exist.
            eject_at_room_exp: true,
            max_participants: input.maxParticipants,
            enable_screenshare: true,
            // We ship our own Firestore-backed chat (persisted + auditable),
            // so the provider's ephemeral chat stays off.
            enable_chat: false,
            enable_knocking: false,
            start_video_off: false,
            start_audio_off: false,
          },
        },
      });
      return { roomId: room.id, roomName: room.name, roomUrl: room.url };
    },

    async issueToken(input: IssueTokenInput): Promise<string> {
      const res = await dailyFetch<DailyTokenResponse>(apiKey, '/meeting-tokens', {
        method: 'POST',
        body: {
          properties: {
            room_name: input.roomName,
            user_name: input.userName,
            user_id: input.userId,
            is_owner: input.isOwner,
            enable_screenshare: input.canScreenShare,
            exp: toExpSeconds(input.expiresAtMs),
          },
        },
      });
      return res.token;
    },

    async deleteRoom(roomName: string): Promise<void> {
      try {
        await dailyFetch(apiKey, `/rooms/${encodeURIComponent(roomName)}`, { method: 'DELETE' });
      } catch (err) {
        // Already gone (or expired and reaped) is success for our purposes.
        if (err instanceof ProviderError && err.status === 404) return;
        throw err;
      }
    },
  };
}
