import { CONSULTATION_MINUTES } from '../../config/video';
import { formatElapsed } from '../../lib/joinWindow';
import type { CallQuality } from '../../services/video/types';

const QUALITY_META: Record<CallQuality, { label: string; bars: number; tone: string }> = {
  good: { label: 'Strong connection', bars: 3, tone: 'good' },
  low: { label: 'Weak connection', bars: 2, tone: 'warn' },
  'very-low': { label: 'Very weak connection', bars: 1, tone: 'bad' },
  unknown: { label: 'Checking connection', bars: 0, tone: 'idle' },
};

/** Three-bar signal meter — the at-a-glance connection indicator. */
export function ConnectionQuality({ quality }: { quality: CallQuality }) {
  const meta = QUALITY_META[quality];
  return (
    <span className={`v-quality v-quality--${meta.tone}`} title={meta.label}>
      <span className="v-quality__bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <i key={bar} className={bar <= meta.bars ? 'is-lit' : ''} />
        ))}
      </span>
      <span className="v-quality__label">{meta.label}</span>
    </span>
  );
}

/**
 * Elapsed consultation time. Ticks from the moment the call connected and turns
 * amber once the nominal slot is used up — a nudge, never a hard cut-off.
 */
export function CallTimer({ elapsedMs }: { elapsedMs: number }) {
  const overrun = elapsedMs > CONSULTATION_MINUTES * 60_000;
  return (
    <span className={`v-timer${overrun ? ' is-overrun' : ''}`} role="timer" aria-live="off">
      <span className="v-timer__dot" aria-hidden="true" />
      {formatElapsed(elapsedMs)}
    </span>
  );
}

export interface CallControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  /** Screen sharing is a doctor-side capability. */
  canScreenShare: boolean;
  chatOpen: boolean;
  unreadCount: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onEnd: () => void;
  /** Doctors "end the consultation" for both sides; patients just leave. */
  endLabel: string;
  busy?: boolean;
}

export function CallControls({
  micOn,
  cameraOn,
  screenOn,
  canScreenShare,
  chatOpen,
  unreadCount,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleChat,
  onEnd,
  endLabel,
  busy = false,
}: CallControlsProps) {
  return (
    <div className="v-controls" role="toolbar" aria-label="Consultation controls">
      <button
        type="button"
        className={`v-ctl ${micOn ? '' : 'is-off'}`}
        onClick={onToggleMic}
        aria-pressed={!micOn}
        aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        <span className="v-ctl__icon" aria-hidden="true">{micOn ? '🎤' : '🔇'}</span>
        <span className="v-ctl__text">{micOn ? 'Mute' : 'Unmute'}</span>
      </button>

      <button
        type="button"
        className={`v-ctl ${cameraOn ? '' : 'is-off'}`}
        onClick={onToggleCamera}
        aria-pressed={!cameraOn}
        aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
      >
        <span className="v-ctl__icon" aria-hidden="true">{cameraOn ? '🎥' : '📷'}</span>
        <span className="v-ctl__text">{cameraOn ? 'Camera' : 'Camera off'}</span>
      </button>

      {canScreenShare ? (
        <button
          type="button"
          className={`v-ctl ${screenOn ? 'is-active' : ''}`}
          onClick={onToggleScreenShare}
          aria-pressed={screenOn}
          aria-label={screenOn ? 'Stop sharing your screen' : 'Share your screen'}
        >
          <span className="v-ctl__icon" aria-hidden="true">🖥️</span>
          <span className="v-ctl__text">{screenOn ? 'Stop share' : 'Share'}</span>
        </button>
      ) : null}

      <button
        type="button"
        className={`v-ctl ${chatOpen ? 'is-active' : ''}`}
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        aria-label="Toggle consultation messages"
      >
        <span className="v-ctl__icon" aria-hidden="true">💬</span>
        <span className="v-ctl__text">Chat</span>
        {unreadCount > 0 && !chatOpen ? (
          <span className="v-ctl__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      <button
        type="button"
        className="v-ctl v-ctl--end"
        onClick={onEnd}
        disabled={busy}
        aria-label={endLabel}
      >
        <span className="v-ctl__icon" aria-hidden="true">✕</span>
        <span className="v-ctl__text">{busy ? 'Ending…' : endLabel}</span>
      </button>
    </div>
  );
}
