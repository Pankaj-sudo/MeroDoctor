import type { CallError, CallErrorKind } from '../../services/video/types';

interface ErrorCopy {
  title: string;
  message: string;
  /** Concrete next step — never a dead end. */
  hint?: string;
}

/**
 * Every failure mode gets designed, specific copy. A patient who cannot join
 * must be told exactly what to do, not shown a stack trace or a generic
 * "something went wrong".
 */
const COPY: Record<CallErrorKind, ErrorCopy> = {
  camera_unavailable: {
    title: 'We can’t reach your camera',
    message: 'Your browser could not start the camera for this consultation.',
    hint: 'Close any other app using the camera (Zoom, Meet, Photo Booth), then retry. You can also continue with audio only.',
  },
  microphone_unavailable: {
    title: 'We can’t reach your microphone',
    message: 'Your browser could not start the microphone.',
    hint: 'Check that no other app is using it, then retry.',
  },
  permission_denied: {
    title: 'Camera and microphone are blocked',
    message: 'Your browser is blocking access to your camera and microphone for this site.',
    hint: 'Open the padlock in the address bar, set Camera and Microphone to “Allow”, then reload this page. On iPhone: Settings → Safari → Camera & Microphone.',
  },
  device_in_use: {
    title: 'Your camera is already in use',
    message: 'Another application is currently holding your camera or microphone.',
    hint: 'Quit the other app, then retry.',
  },
  network_lost: {
    title: 'Connection lost',
    message: 'Your network dropped during the consultation.',
    hint: 'We’ll keep trying to reconnect. If this persists, move closer to your router or switch to mobile data.',
  },
  provider_timeout: {
    title: 'The consultation service is slow to respond',
    message: 'We could not reach the video service in time.',
    hint: 'This is usually temporary — retry in a moment.',
  },
  room_expired: {
    title: 'This consultation room has closed',
    message: 'The room for this consultation is no longer available.',
    hint: 'If your consultation has not happened yet, please contact the clinic to reopen it.',
  },
  not_allowed: {
    title: 'You don’t have access to this consultation',
    message: 'Only the assigned patient and their doctor can join this room.',
    hint: 'Check that you are signed in with the account you booked with.',
  },
  unknown: {
    title: 'The consultation could not be started',
    message: 'Something unexpected went wrong setting up your video call.',
    hint: 'Retry, and if it happens again please contact the clinic.',
  },
};

export function CallErrorScreen({
  error,
  onRetry,
  onLeave,
}: {
  error: CallError;
  onRetry?: () => void;
  onLeave?: () => void;
}) {
  const copy = COPY[error.kind] ?? COPY.unknown;
  return (
    <div className="v-error" role="alert">
      <span className="v-error__glyph" aria-hidden="true">
        {error.kind === 'permission_denied' ? '🔒' : '⚠'}
      </span>
      <h2 className="v-error__title">{copy.title}</h2>
      <p className="v-error__msg">{copy.message}</p>
      {copy.hint ? <p className="v-error__hint">{copy.hint}</p> : null}
      {/* The provider's own message, kept subtle — useful when calling support. */}
      {error.message && error.message !== copy.message ? (
        <p className="v-error__detail mono">{error.message}</p>
      ) : null}
      <div className="v-error__actions">
        {onRetry ? (
          <button type="button" className="v-btn v-btn--primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {onLeave ? (
          <button type="button" className="v-btn v-btn--ghost" onClick={onLeave}>
            Back to my consultation
          </button>
        ) : null}
      </div>
    </div>
  );
}
