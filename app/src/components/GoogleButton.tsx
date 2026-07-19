import { Spinner } from './Spinner';

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2.1 1.5-4.8 2.5-7.6 2.5-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5C39.9 36.4 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
    />
  </svg>
);

/**
 * Premium "Continue with Google" button. Disables + shows a spinner while busy
 * (which also prevents duplicate clicks), and exposes `aria-busy` for a11y.
 */
export function GoogleButton({
  onClick,
  busy = false,
  label = 'Continue with Google',
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="google-btn"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
    >
      <span className="google-btn__icon">{busy ? <Spinner size={18} /> : <GoogleGlyph />}</span>
      <span>{busy ? 'Connecting…' : label}</span>
    </button>
  );
}
