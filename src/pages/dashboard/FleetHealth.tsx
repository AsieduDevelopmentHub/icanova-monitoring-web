import type { BoardRow } from "./types";
import { isRunning, isStopped, storedFreshness } from "./logic";

export function FleetHealth({ rows }: { rows: BoardRow[] }) {
  const now = Date.now();
  const running = rows.filter(isRunning).length;
  const stopped = rows.filter(isStopped).length;
  const stale = rows.filter((row) => storedFreshness(row.updatedAt, now).stale).length;
  const alarms = rows.filter((row) => (row.alarmCount ?? 0) > 0).length;
  const other = Math.max(0, rows.length - running - stopped);

  const bars = [
    { key: "run", label: "Running", value: running, className: "is-ok" },
    { key: "stop", label: "Stopped", value: stopped, className: "is-idle" },
    { key: "alarm", label: "Alarms", value: alarms, className: "is-alarm" },
    { key: "stale", label: "Stale", value: stale, className: "is-warn" },
    { key: "other", label: "Other", value: other, className: "is-muted" },
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <section className="cc-fleet-health" aria-label="Fleet health">
      <header className="cc-section-head">
        <h2 className="cc-section-title">Fleet health</h2>
      </header>
      <ul className="cc-health-bars">
        {bars.map((bar) => (
          <li key={bar.key} className={bar.className}>
            <div className="cc-health-meta">
              <span>{bar.label}</span>
              <span className="tech">{bar.value}</span>
            </div>
            <div className="cc-health-track" aria-hidden="true">
              <span style={{ width: `${(bar.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
