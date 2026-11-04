import { Link } from "react-router";
import { GridTable } from "../ui/GridTable";
import { useLiveNow } from "../ui/useLiveNow";
import { SiteAlarmBell } from "./SiteAlarmBell";
import { siteLiveState } from "./siteStatus";
import {
  formatActivityAge,
  formatLastUpdated,
  powerSourceLabel,
  siteAttentionIssues,
  siteLastActivityAt,
  type SiteRosterRow,
} from "./siteRosterView";
import { useThrottledRoster } from "./useThrottledRoster";

/** Hover age tick — independent of the throttled roster field refresh. */
const ROSTER_LIVE_TICK_MS = 5_000;

export function SiteRosterGrid({
  rows,
  caption = "Sites",
}: {
  rows: readonly SiteRosterRow[];
  caption?: string;
}) {
  const now = useLiveNow(ROSTER_LIVE_TICK_MS);
  // Stable order + batched Last Updated / health so rows do not jump every ingest.
  const displayRows = useThrottledRoster(rows);

  return (
    <GridTable
      caption={caption}
      rows={displayRows}
      getRowKey={(row) => row.siteId}
      empty="No sites"
      initialPageSize={25}
      columns={[
        {
          key: "code",
          header: "Site ID",
          width: "6.5rem",
          render: (row) => <span className="tech">{row.code ?? "—"}</span>,
        },
        {
          key: "name",
          header: "Site Name",
          width: "11rem",
          render: (row) => {
            const issues = siteAttentionIssues(row);
            return (
              <span className="cc-site-name-cell">
                <Link to={`/sites/${row.siteId}`} title={row.name}>
                  {row.name}
                </Link>
                <SiteAlarmBell
                  siteId={row.siteId}
                  siteLabel={`${row.code ?? "—"} | ${row.name}`}
                  issues={issues}
                />
              </span>
            );
          },
        },
        {
          key: "updated",
          header: "Last Updated",
          width: "10rem",
          render: (row) => {
            const at = siteLastActivityAt(row);
            const live = siteLiveState(row, now);
            const absolute = formatLastUpdated(at);
            const age = formatActivityAge(at, now);
            return (
              <span className="cc-live-cell" title={`${live.label} · ${age}`}>
                <span className="tech" title={age}>
                  {absolute}
                </span>
                <span
                  className={`cc-live-dot tone-${live.tone}`}
                  title={`${live.label} · ${age}`}
                  aria-label={live.label}
                />
              </span>
            );
          },
        },
        {
          key: "power",
          header: "Power Source",
          width: "8.5rem",
          render: (row) => powerSourceLabel(row),
        },
        {
          key: "gateway",
          header: "Gateway ID",
          width: "8rem",
          render: (row) =>
            row.gatewayId ? (
              <span className="tech" title={row.gatewayName ?? undefined}>
                {row.gatewayId}
              </span>
            ) : (
              "—"
            ),
        },
        {
          key: "region",
          header: "Region",
          width: "7rem",
          render: (row) => row.region ?? "—",
        },
        {
          key: "gens",
          header: "Gens",
          align: "right",
          width: "3.75rem",
          render: (row) => String(row.generators ?? "—"),
        },
      ]}
    />
  );
}
