import { DEFAULT_VIDEO_PROVIDER } from '../../../src/config/video.js';
import type { VideoProviderId } from '../../../src/types/video.js';
import { createDailyProvider } from './daily.js';
import { ProviderError } from './types.js';
import type { RoomProvider } from './types.js';

// ============================================================================
// Provider registry. `getRoomProvider()` resolves the provider to use, so a
// room created under one provider is always torn down / re-tokened by the SAME
// provider even after the platform default changes.
//
// To add a provider:
//   1. implement RoomProvider in ./<name>.ts
//   2. add a case below and its API-key env var
// Nothing outside this folder needs to change.
// ============================================================================

/** Which provider new rooms use. Overridable per-environment. */
export function defaultProviderId(): VideoProviderId {
  const fromEnv = process.env.VIDEO_PROVIDER?.trim().toLowerCase();
  return (fromEnv || DEFAULT_VIDEO_PROVIDER) as VideoProviderId;
}

export function getRoomProvider(id: VideoProviderId = defaultProviderId()): RoomProvider {
  switch (id) {
    case 'daily': {
      const apiKey = process.env.DAILY_API_KEY;
      if (!apiKey) {
        throw new ProviderError(
          'DAILY_API_KEY is not configured on the server. Add it in the Vercel project ' +
            'environment variables and redeploy.',
          500,
        );
      }
      return createDailyProvider(apiKey);
    }
    // Implemented on demand — see the interface in ./types.ts.
    case 'livekit':
    case 'zoom':
    case 'agora':
    case 'twilio':
    case 'meet':
      throw new ProviderError(`Video provider "${id}" is not implemented yet.`, 501);
    default:
      throw new ProviderError(`Unknown video provider "${String(id)}".`, 500);
  }
}

export { ProviderError };
export type { RoomProvider };
