import { useMemo } from "react";
import { Link } from "react-router";
import { GridTable } from "../ui/GridTable";
import { useLiveNow } from "../ui/useLiveNow";
import { SiteAlarmBell } from "./SiteAlarmBell";
import { siteLiveState } from "./siteStatus";
import {
  formatLastUpdated,
  powerSourceLabel,
  siteAttentionIssues,
  siteLastActivityAt,
  sortSitesByLastUpdated,
  type SiteRosterRow,
} from "./siteRosterView";

export function SiteRosterGrid({
  rows,
  caption = "Sites",
}: {
  rows: readonly SiteRosterRow[];
  caption?: string;
}) {
  const now = useLiveNow();
  const sorted = useMemo(() => sortSitesByLastUpdated(rows), [rows]);

  return (
    <GridTable
      caption={caption}
      rows={sorted}
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
            const live = siteLiveState(row, now);
            return (
              <span className="cc-live-cell">
                <span className="tech">{formatLastUpdated(siteLastActivityAt(row))}</span>
                <span
                  className={`cc-live-dot tone-${live.tone}`}
                  title={live.label}
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
