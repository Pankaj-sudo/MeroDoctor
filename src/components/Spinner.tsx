/** Inline spinner (buttons, small areas). Size via the `size` prop. */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="spinner"
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
    />
  );
}

/** Centered, full-viewport loading state (route guards, initial load). */
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="full-spinner">
      <Spinner size={30} />
      {label ? <p className="full-spinner__label">{label}</p> : null}
    </div>
  );
}
