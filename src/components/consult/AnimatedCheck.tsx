/** Success checkmark that draws itself in (animation lives in consult.css). */
export function AnimatedCheck() {
  return (
    <svg className="c-check" viewBox="0 0 52 52" aria-hidden="true">
      <circle className="c-check__ring" cx="26" cy="26" r="24" fill="none" />
      <path className="c-check__mark" fill="none" d="M15 27 l7 7 l15 -16" />
    </svg>
  );
}
