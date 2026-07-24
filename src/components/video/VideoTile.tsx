import { useEffect, useRef } from 'react';
import type { CallParticipant } from '../../services/video/types';

/**
 * Renders one participant's video (or their screen share).
 *
 * Attaching a MediaStreamTrack imperatively — rather than binding `srcObject`
 * in JSX — is what keeps playback reliable across browsers. The stream is
 * rebuilt only when the underlying track identity changes, so a mute/unmute
 * does not tear down and restart the element (which is what causes the black
 * flash seen in naive implementations).
 *
 * `playsInline` + `muted` on the local tile are mandatory for iOS Safari: a
 * non-muted autoplaying video is blocked outright, and without playsInline iOS
 * takes the call fullscreen.
 */
export function VideoTile({
  participant,
  variant,
  label,
  showScreen = false,
}: {
  participant: CallParticipant | null;
  variant: 'stage' | 'pip';
  label: string;
  /** Render the screen-share track instead of the camera. */
  showScreen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const videoTrack = showScreen
    ? (participant?.screenVideoTrack ?? null)
    : (participant?.videoTrack ?? null);
  // Local audio is never played back locally — that would cause feedback.
  const audioTrack = participant?.isLocal ? null : (participant?.audioTrack ?? null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!videoTrack) {
      el.srcObject = null;
      return;
    }
    el.srcObject = new MediaStream([videoTrack]);
    // Autoplay can still be rejected (e.g. iOS Low Power Mode); the poster-like
    // placeholder underneath stays visible, so a rejection is never a blank tile.
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [videoTrack]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!audioTrack) {
      el.srcObject = null;
      return;
    }
    el.srcObject = new MediaStream([audioTrack]);
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [audioTrack]);

  const cameraOff = !videoTrack || (!showScreen && !participant?.videoOn);
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className={`v-tile v-tile--${variant}`}>
      <video
        ref={videoRef}
        className="v-tile__video"
        autoPlay
        playsInline
        // The local preview must be muted or the clinician hears themselves.
        muted={participant?.isLocal ?? true}
        // Mirror only your own camera — mirroring the other person is disorienting.
        data-mirror={participant?.isLocal && !showScreen ? 'true' : 'false'}
      />
      {audioTrack ? <audio ref={audioRef} autoPlay playsInline /> : null}

      {cameraOff ? (
        <div className="v-tile__placeholder" aria-hidden="true">
          <span className="v-tile__monogram">{initials || '·'}</span>
        </div>
      ) : null}

      <div className="v-tile__meta">
        <span className="v-tile__name">{label}</span>
        <span className="v-tile__indicators">
          <span
            className={`v-ind ${participant?.audioOn ? 'is-on' : 'is-off'}`}
            title={participant?.audioOn ? 'Microphone on' : 'Microphone muted'}
          >
            {participant?.audioOn ? '🎤' : '🔇'}
          </span>
          <span
            className={`v-ind ${participant?.videoOn ? 'is-on' : 'is-off'}`}
            title={participant?.videoOn ? 'Camera on' : 'Camera off'}
          >
            {participant?.videoOn ? '🎥' : '📷'}
          </span>
        </span>
      </div>
    </div>
  );
}
