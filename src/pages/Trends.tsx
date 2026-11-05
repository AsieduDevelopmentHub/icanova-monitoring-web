import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { sitePath } from "../fleet/paths";
import { LiveGate } from "../fleet/scope";
import {
  powerSourceLabel,
  siteAttentionIssues,
  siteLastActivityAt,
  type SiteRosterRow,
} from "../sites/siteRosterView";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Metric } from "../ui/Metric";
import { PageSkeleton, Skeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";

/** Org-wide health / status desk — not single-generator charts. */
export function Trends() {
  return (
    <section className="page ops-page analytics-page">
      <LiveGate emptyLayout="list" emptyCaption="Trends" emptyColumns={["Site", "Cloud", "Link", "Freshness"]}>
        {(org) => <TrendsBody organizationId={org.organizationId} permissions={org.permissions} />}
      </LiveGate>
    </section>
  );
}

function TrendsBody({
  organizationId,
  permissions,
}: {
  organizationId: string;
  permissions: readonly string[];
}) {
  const orgId = id<"organizations">(organizationId);
  const overview = useQuery(
    api.siteStats.commandOverview,
    permissions.includes("view.dashboard") ? { organizationId: orgId } : "skip",
  );
  const roster = useQuery(
    api.telemetry.siteRoster,
    permissions.includes("view.telemetry") || permissions.includes("view.dashboard")
      ? { organizationId: orgId }
      : "skip",
  );

  if (!permissions.includes("view.dashboard") && !permissions.includes("view.telemetry")) {
    return <EmptyState title="Access required" body="Dashboard or telemetry permission is needed for trends." />;
  }
  if (overview === undefined || roster === undefined) {
    return <PageSkeleton rows={6} label="Loading org health" />;
  }

  const rows = roster as SiteRosterRow[];
  const counts = overview.siteCounts;
  const attention = rows.filter(
    (row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0 || row.linkFail > 0 || (row.alarmCount ?? 0) > 0,
  );
  const cloudOffline = rows.filter((row) => row.gatewayOffline > 0).length;
  const linkFail = rows.filter((row) => row.linkFail > 0 || row.link === "fail").length;
  const alarmSites = rows.filter((row) => (row.alarmCount ?? 0) > 0).length;

  return (
    <div className="stack">
      <p className="meta page-lede">
        Organization health across sites. Cloud contact, Modbus link, and sample freshness are tracked separately.
      </p>

      <div className="metric-grid metric-grid-primary">
        <Metric label="Sites" value={String(counts.total)} />
        <Metric label="Cloud updating" value={String(counts.updating)} tone="ok" />
        <Metric
          label="Cloud not updating"
          value={String(counts.nonUpdating)}
          tone={counts.nonUpdating > 0 ? "warn" : "ok"}
        />
        <Metric label="Fresh telemetry" value={String(counts.currentData)} tone="ok" />
        <Metric
          label="Accumulated / stale"
          value={String(counts.accumulatedData)}
          tone={counts.accumulatedData > 0 ? "warn" : "ok"}
        />
        <Metric label="Attention sites" value={String(attention.length)} tone={attention.length > 0 ? "alarm" : "ok"} />
      </div>

      <div className="metric-grid">
        <Metric label="Sites · cloud offline" value={String(cloudOffline)} tone={cloudOffline > 0 ? "warn" : "ok"} />
        <Metric label="Sites · Modbus fail" value={String(linkFail)} tone={linkFail > 0 ? "alarm" : "ok"} />
        <Metric label="Sites · active alarms" value={String(alarmSites)} tone={alarmSites > 0 ? "alarm" : "ok"} />
      </div>

      {overview.regions.length > 0 ? (
        <section className="ops-section" aria-labelledby="trends-regions-title">
          <h2 id="trends-regions-title" className="cc-section-title">
            Regional cloud status
          </h2>
          <DataTable
            dense
            caption="Sites updating by region (gateway online)"
            rows={overview.regions.filter((row) => row.updating + row.nonUpdating > 0)}
            getRowKey={(row) => row.region}
            empty="No regional activity yet."
            columns={[
              { key: "region", header: "Region", render: (row) => row.region },
              {
                key: "updating",
                header: "Updating",
                align: "right",
                render: (row) => row.updating,
              },
              {
                key: "nonUpdating",
                header: "Not updating",
                align: "right",
                render: (row) => row.nonUpdating,
              },
            ]}
          />
        </section>
      ) : (
        <Skeleton lines={3} />
      )}

      <section className="ops-section" aria-labelledby="trends-sites-title">
        <header className="cc-section-head">
          <h2 id="trends-sites-title" className="cc-section-title">
            Site status
          </h2>
          <Link to="/sites" className="meta">
            Manage sites
          </Link>
        </header>
        {rows.length === 0 ? (
          <EmptyState title="No sites" body="Provision a site to see org health trends." action={<Link to="/sites">Sites</Link>} />
        ) : (
          <DataTable
            dense
            caption="Org site health"
            rows={rows}
            getRowKey={(row) => row.siteId}
            empty="No sites."
            columns={[
              {
                key: "name",
                header: "Site",
                render: (row) => <Link to={sitePath(row.siteId)}>{row.name}</Link>,
              },
              {
                key: "region",
                header: "Region",
                render: (row) => row.region ?? "—",
              },
              {
                key: "cloud",
                header: "Cloud",
                render: (row) => (
                  <StatusMark tone={row.gatewayOffline > 0 ? "warn" : row.gatewayOnline > 0 ? "ok" : "neutral"}>
                    {row.gatewayOffline > 0 ? "offline" : row.gatewayOnline > 0 ? "online" : "—"}
                  </StatusMark>
                ),
              },
              {
                key: "link",
                header: "Modbus",
                render: (row) => (
                  <StatusMark tone={row.linkFail > 0 || row.link === "fail" ? "alarm" : row.link === "ok" ? "ok" : "neutral"}>
                    {row.linkFail > 0 || row.link === "fail" ? "fail" : row.link ?? "—"}
                  </StatusMark>
                ),
              },
              {
                key: "fresh",
                header: "Freshness",
                render: (row) => {
                  const at = siteLastActivityAt(row);
                  if (at == null) {
                    return "—";
                  }
                  const ageMin = Math.round((Date.now() - at) / 60_000);
                  return ageMin <= 15 ? "fresh" : ageMin <= 60 ? "aging" : "stale";
                },
              },
              {
                key: "power",
                header: "Power",
                render: (row) => powerSourceLabel(row),
              },
              {
                key: "alarms",
                header: "Alarms",
                align: "right",
                render: (row) => row.alarmCount ?? 0,
              },
              {
                key: "issues",
                header: "Attention",
                render: (row) => {
                  const issues = siteAttentionIssues(row);
                  return issues.length ? issues.join(" · ") : "—";
                },
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
