import { useState } from "react";
import { Link } from "react-router";
import { GridTable } from "../ui/GridTable";
import { Icon } from "../ui/icons";
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
import { StatusMark } from "../ui/StatusMark";
import { useThrottledRoster } from "./useThrottledRoster";

/** Hover age tick — independent of the throttled roster field refresh. */
const ROSTER_LIVE_TICK_MS = 5_000;

export function SiteRosterGrid({
  rows,
  caption = "Sites",
  mobileCards = false,
  preserveOrder = false,
}: {
  rows: readonly SiteRosterRow[];
  caption?: string;
  mobileCards?: boolean;
  preserveOrder?: boolean;
}) {
  const now = useLiveNow(ROSTER_LIVE_TICK_MS);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(() => new Set());
  // Keep the legacy roster order stable; filterable explorer order is explicit.
  const stableRows = useThrottledRoster(rows);
  const displayRows = preserveOrder ? [...rows] : stableRows;
  const renderMobileRow = mobileCards
    ? (row: SiteRosterRow) => {
        const issues = siteAttentionIssues(row);
        const activityAt = siteLastActivityAt(row);
        const live = siteLiveState(row, now);
        const expanded = expandedSites.has(row.siteId);
        const detailsId = `site-card-details-${row.siteId}`;
        return (
          <article className={expanded ? "site-roster-card is-expanded" : "site-roster-card"}>
            <header className="site-roster-card-head">
              <div className="site-roster-card-identity">
                <span className="site-roster-card-code tech">{row.code ?? "—"}</span>
                <Link to={`/sites/${row.siteId}`} title={row.name}>
                  {row.name}
                </Link>
              </div>
              <SiteAlarmBell
                siteId={row.siteId}
                siteLabel={`${row.code ?? "—"} | ${row.name}`}
                issues={issues}
              />
              <button
                type="button"
                className="site-roster-card-toggle"
                aria-label={`${expanded ? "Collapse" : "Expand"} ${row.name} details`}
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() =>
                  setExpandedSites((current) => {
                    const next = new Set(current);
                    if (next.has(row.siteId)) {
                      next.delete(row.siteId);
                    } else {
                      next.add(row.siteId);
                    }
                    return next;
                  })
                }
              >
                <Icon name={expanded ? "chevronUp" : "chevronDown"} />
              </button>
            </header>
            <div className="site-roster-card-status">
              <StatusMark tone={live.tone}>{live.label}</StatusMark>
              <time
                className="meta"
                dateTime={activityAt == null ? undefined : new Date(activityAt).toISOString()}
                title={formatActivityAge(activityAt, now)}
              >
                {formatLastUpdated(activityAt)}
              </time>
            </div>
            <dl id={detailsId} className="site-roster-card-facts" hidden={!expanded}>
              <div>
                <dt>Power source</dt>
                <dd>{powerSourceLabel(row)}</dd>
              </div>
              <div>
                <dt>Battery</dt>
                <dd className="tech">
                  {typeof row.batteryV === "number" && Number.isFinite(row.batteryV)
                    ? `${row.batteryV.toFixed(1)} V`
                    : "N/A"}
                </dd>
              </div>
              <div>
                <dt>Gateway</dt>
                <dd className="tech">{row.gatewayId ?? "—"}</dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{row.region ?? "—"}</dd>
              </div>
              <div>
                <dt>Fuel level</dt>
                <dd className="tech">
                  {typeof row.primaryFuelPct === "number" && Number.isFinite(row.primaryFuelPct)
                    ? `${row.primaryFuelPct}%`
                    : "N/A"}
                </dd>
              </div>
              <div>
                <dt>HRM</dt>
                <dd className="tech">
                  {typeof row.primaryEngineHours === "number" && Number.isFinite(row.primaryEngineHours)
                    ? row.primaryEngineHours.toLocaleString(undefined, { maximumFractionDigits: 1 })
                    : "N/A"}
                </dd>
              </div>
            </dl>
          </article>
        );
      }
    : undefined;

  return (
    <GridTable
      caption={caption}
      rows={displayRows}
      getRowKey={(row) => row.siteId}
      empty="No sites"
      initialPageSize={25}
      renderMobileRow={renderMobileRow}
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
          key: "battery",
          header: "Battery (V)",
          align: "right",
          width: "5.5rem",
          render: (row) => {
            const v = row.batteryV;
            if (typeof v !== "number" || !Number.isFinite(v)) {
              return "N/A";
            }
            const tone = v < 11.5 ? "warn" : v < 12.2 ? "warn" : "ok";
            return (
              <span className={`tech tone-${tone}`} title="12 V starter battery">
                {v.toFixed(1)}
              </span>
            );
          },
        },
        {
          key: "fuel",
          header: "Fuel %",
          align: "right",
          width: "5rem",
          render: (row) =>
            typeof row.primaryFuelPct === "number" && Number.isFinite(row.primaryFuelPct)
              ? <span className="tech">{row.primaryFuelPct.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              : "N/A",
        },
        {
          key: "hrm",
          header: "HRM (h)",
          align: "right",
          width: "5rem",
          render: (row) =>
            typeof row.primaryEngineHours === "number" && Number.isFinite(row.primaryEngineHours)
              ? <span className="tech">{row.primaryEngineHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              : "N/A",
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
