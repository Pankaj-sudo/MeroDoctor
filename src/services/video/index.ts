import { DEFAULT_VIDEO_PROVIDER } from '../../config/video';
import type { VideoProviderId } from '../../types/video';
import type { VideoClientProvider } from './types';

// ============================================================================
// Client provider registry.
//
// Adapters are resolved lazily by id so an unused vendor SDK is never even
// referenced, let alone downloaded. A room always plays back through the
// provider that created it (the join grant carries the id), which is what makes
// switching the default provider safe for consultations already in flight.
// ============================================================================

export async function getVideoClientProvider(
  id: VideoProviderId = DEFAULT_VIDEO_PROVIDER,
): Promise<VideoClientProvider> {
  switch (id) {
    case 'daily': {
      const { dailyClientProvider } = await import('./daily');
      return dailyClientProvider;
    }
    // Add an adapter file implementing VideoClientProvider and a case here.
    case 'livekit':
    case 'zoom':
    case 'agora':
    case 'twilio':
    case 'meet':
      throw new Error(`Video provider "${id}" is not available in this build yet.`);
    default:
      throw new Error(`Unknown video provider "${String(id)}".`);
  }
}

export type * from './types';
