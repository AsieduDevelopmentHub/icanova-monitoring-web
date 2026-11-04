import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "../../ui/Skeleton";
import { horseshoeSegments } from "./chartGeometry";

const UPDATING = "var(--color-muted-copper, #b87333)";
const NON_UPDATING = "var(--color-light-silver, #c5c9ce)";
const TOTAL = "var(--info, #477ca8)";
const CURRENT = "var(--ok, #24845b)";
const ACCUMULATED = "#7a5ea8";

export function RegionStats({ organizationId }: { organizationId: Id<"organizations"> }) {
  const stats = useQuery(api.siteStats.commandOverview, { organizationId });
  if (stats === undefined) {
    return <Skeleton lines={8} />;
  }
  const max = Math.max(
    1,
    ...stats.regions.map((row) => Math.max(row.updating, row.nonUpdating)),
  );
  const counts = stats.siteCounts;

  return (
    <div className="cc-stats-grid">
      <section className="ops-section cc-region-card" aria-labelledby="cc-regions-title">
        <h2 id="cc-regions-title">Regional reporting</h2>
        <RegionBarChart regions={stats.regions} max={max} />
      </section>

      <section className="ops-section cc-site-count-card" aria-labelledby="cc-sites-stats-title">
        <h2 id="cc-sites-stats-title">Site overview</h2>
        <SiteCountHorseshoe counts={counts} />
      </section>
    </div>
  );
}

/** Compact axis labels — full name stays on hover / tooltip. */
const REGION_SHORT: Record<string, string> = {
  "Greater Accra": "G. Accra",
  "North East": "N. East",
  "Upper East": "U. East",
  "Upper West": "U. West",
  "Western North": "W. North",
  "Bono East": "Bono E.",
};

function regionAxisLabel(region: string): string {
  return REGION_SHORT[region] ?? region;
}

function RegionBarChart({
  regions,
  max,
}: {
  regions: readonly { region: string; updating: number; nonUpdating: number }[];
  max: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hovered = regions.find((row) => row.region === hover) ?? null;

  return (
    <div className="region-chart" role="img" aria-label="Region updating versus non-updating">
      <div className="region-chart-y" aria-hidden="true">
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="region-chart-main">
        <div className="region-chart-frame">
          <div className="region-chart-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="region-chart-plot">
            {regions.map((row) => {
              const updatingH = (row.updating / max) * 100;
              const nonH = (row.nonUpdating / max) * 100;
              return (
                <div
                  key={row.region}
                  className={`region-bar-col${hover === row.region ? " is-hover" : ""}`}
                  onMouseEnter={() => setHover(row.region)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="region-bar-pair">
                    <span
                      className="region-bar updating"
                      style={{
                        height: `${Math.max(updatingH, row.updating > 0 ? 2 : 0)}%`,
                        background: UPDATING,
                      }}
                      title={`${row.region} updating ${row.updating}`}
                    />
                    <span
                      className="region-bar non-updating"
                      style={{
                        height: `${Math.max(nonH, row.nonUpdating > 0 ? 2 : 0)}%`,
                        background: NON_UPDATING,
                      }}
                      title={`${row.region} non-updating ${row.nonUpdating}`}
                    />
                  </div>
                  <span className="region-bar-label" title={row.region}>
                    {regionAxisLabel(row.region)}
                  </span>
                </div>
              );
            })}
          </div>
          {hovered ? (
            <div className="region-chart-tooltip" role="status">
              <strong>{hovered.region}</strong>
              <span>
                <i style={{ background: UPDATING }} /> Updating: {hovered.updating}
              </span>
              <span>
                <i style={{ background: NON_UPDATING }} /> Non Updating: {hovered.nonUpdating}
              </span>
            </div>
          ) : null}
        </div>
        <div className="region-chart-legend">
          <span>
            <i style={{ background: UPDATING }} /> Updating
          </span>
          <span>
            <i style={{ background: NON_UPDATING }} /> Non Updating
          </span>
        </div>
      </div>
    </div>
  );
}

function SiteCountHorseshoe({
  counts,
}: {
  counts: {
    total: number;
    updating: number;
    nonUpdating: number;
    currentData: number;
    accumulatedData: number;
  };
}) {
  const rings = useMemo(() => {
    const cx = 70;
    const cy = 70;
    const outer = horseshoeSegments(cx, cy, 54, [{ value: Math.max(counts.total, 1), color: TOTAL }]);
    const mid = horseshoeSegments(cx, cy, 40, [
      { value: counts.updating, color: UPDATING },
      { value: counts.nonUpdating, color: NON_UPDATING },
    ]);
    const inner = horseshoeSegments(cx, cy, 26, [
      { value: counts.currentData, color: CURRENT },
      { value: counts.accumulatedData, color: ACCUMULATED },
    ]);
    return { outer, mid, inner };
  }, [counts]);

  const legend = [
    { color: TOTAL, label: "Total", value: counts.total },
    { color: UPDATING, label: "Updating", value: counts.updating },
    { color: NON_UPDATING, label: "Non Updating", value: counts.nonUpdating },
    { color: CURRENT, label: "Current Data", value: counts.currentData },
    { color: ACCUMULATED, label: "Accumulated Data", value: counts.accumulatedData },
  ];

  return (
    <div className="site-count-stats">
      <div className="site-count-viz">
        <svg viewBox="0 0 140 140" className="site-count-ring" aria-hidden="true">
          {[...rings.outer, ...rings.mid, ...rings.inner].map((seg, index) =>
            seg.d ? (
              <path
                key={`${seg.color}-${index}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth={10}
                strokeLinecap="butt"
              />
            ) : null,
          )}
        </svg>
        <p className="site-count-total meta">
          Total: <strong>{counts.total}</strong>
        </p>
      </div>
      <ul className="site-count-legend">
        {legend.map((item) => (
          <li key={item.label}>
            <i style={{ background: item.color }} />
            <span>
              {item.label} ({item.value})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
