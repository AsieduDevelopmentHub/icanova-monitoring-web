import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "../../ui/Skeleton";

const UPDATING = "var(--color-muted-copper)";
const NON_UPDATING = "var(--color-light-silver)";
const TOTAL = "var(--info)";
const CURRENT = "var(--ok)";
const ACCUMULATED = "#7a5ea8";

export function RegionStats({ organizationId }: { organizationId: Id<"organizations"> }) {
  const stats = useQuery(api.siteStats.commandOverview, { organizationId });
  if (stats === undefined) {
    return <Skeleton lines={8} />;
  }
  const max = Math.max(1, ...stats.regions.map((row) => row.updating + row.nonUpdating));
  const counts = stats.siteCounts;
  const total = Math.max(1, counts.total);

  return (
    <div className="cc-stats-grid">
      <section className="ops-section" aria-labelledby="cc-regions-title">
        <h2 id="cc-regions-title">Regions</h2>
        <div className="region-chart" role="img" aria-label="Region updating statistics">
          <div className="region-chart-plot">
            {stats.regions.map((row) => {
              const height = ((row.updating + row.nonUpdating) / max) * 100;
              const updatingShare =
                row.updating + row.nonUpdating === 0
                  ? 0
                  : (row.updating / (row.updating + row.nonUpdating)) * 100;
              return (
                <div
                  key={row.region}
                  className="region-bar-col"
                  title={`${row.region}: ${row.updating} updating, ${row.nonUpdating} non-updating`}
                >
                  <div className="region-bar-stack" style={{ height: `${Math.max(height, 2)}%` }}>
                    <span
                      className="region-bar updating"
                      style={{ height: `${updatingShare}%`, background: UPDATING }}
                    />
                    <span
                      className="region-bar non-updating"
                      style={{ height: `${100 - updatingShare}%`, background: NON_UPDATING }}
                    />
                  </div>
                  <span className="region-bar-label">{row.region}</span>
                </div>
              );
            })}
          </div>
          <div className="region-chart-legend">
            <span>
              <i style={{ background: UPDATING }} /> Updating
            </span>
            <span>
              <i style={{ background: NON_UPDATING }} /> Non-Updating
            </span>
          </div>
        </div>
      </section>

      <section className="ops-section" aria-labelledby="cc-sites-stats-title">
        <h2 id="cc-sites-stats-title">Sites</h2>
        <div className="site-count-stats">
          <svg viewBox="0 0 120 120" className="site-count-ring" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={TOTAL}
              strokeWidth="8"
              strokeDasharray={`${(counts.total / total) * 301} 301`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <circle cx="60" cy="60" r="36" fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="36"
              fill="none"
              stroke={UPDATING}
              strokeWidth="8"
              strokeDasharray={`${(counts.updating / total) * 226} 226`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <circle cx="60" cy="60" r="24" fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="24"
              fill="none"
              stroke={CURRENT}
              strokeWidth="8"
              strokeDasharray={`${(counts.currentData / total) * 151} 151`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <ul className="site-count-legend">
            <li>
              <i style={{ background: TOTAL }} />
              <span>Total</span>
              <strong>{counts.total}</strong>
            </li>
            <li>
              <i style={{ background: UPDATING }} />
              <span>Updating</span>
              <strong>{counts.updating}</strong>
            </li>
            <li>
              <i style={{ background: NON_UPDATING }} />
              <span>Non-Updating</span>
              <strong>{counts.nonUpdating}</strong>
            </li>
            <li>
              <i style={{ background: CURRENT }} />
              <span>Current</span>
              <strong>{counts.currentData}</strong>
            </li>
            <li>
              <i style={{ background: ACCUMULATED }} />
              <span>Accumulated</span>
              <strong>{counts.accumulatedData}</strong>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
