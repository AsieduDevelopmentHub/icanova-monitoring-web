/** Animated session / auth gate — looping industrial pulse instead of bare text. */
export function SessionPulse({
  label = "Checking session",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "session-pulse is-compact" : "session-pulse"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="session-pulse-field" aria-hidden="true">
        <span className="session-pulse-sweep" />
        <span className="session-pulse-grid" />
      </div>
      <div className="session-pulse-orb" aria-hidden="true">
        <span className="session-pulse-ring" />
        <span className="session-pulse-ring is-delay" />
        <span className="session-pulse-ring is-delay-2" />
        <span className="session-pulse-core" />
      </div>
      <p className="session-pulse-label">
        {label}
        <span className="session-pulse-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  );
}
