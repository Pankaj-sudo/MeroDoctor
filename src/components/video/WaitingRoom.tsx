/**
 * The waiting room — shown while the room is being prepared, while joining, and
 * while the other participant has not yet arrived. Deliberately calm and
 * reassuring: a patient sitting here is often anxious, so it always says what
 * is happening and what happens next.
 */
export function WaitingRoom({
  title,
  message,
  waitingFor,
  showSpinner = true,
}: {
  title: string;
  message: string;
  /** Name of the person we're waiting on, when known. */
  waitingFor?: string | null;
  showSpinner?: boolean;
}) {
  return (
    <div className="v-wait">
      {showSpinner ? (
        <div className="v-wait__pulse" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <h2 className="v-wait__title">{title}</h2>
      <p className="v-wait__msg">{message}</p>
      {waitingFor ? (
        <p className="v-wait__who">
          Waiting for <strong>{waitingFor}</strong> to join…
        </p>
      ) : null}
    </div>
  );
}
