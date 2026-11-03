import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { QueryErrorBoundary } from "../ui/QueryErrorBoundary";
import { StatusMark } from "../ui/StatusMark";
import { StatusStrip } from "../ui/StatusStrip";
import { Skeleton } from "../ui/Skeleton";
import { RegionStats } from "./dashboard/RegionStats";

/** Fleet Command Center — overview that drills into sites. */
export function Dashboard() {
  return (
    <section className="page cc-page">
      <header className="page-head">
        <h1>Command Center</h1>
      </header>
      <LiveGate emptyLayout="command">
        {(org) => <CommandCenter organizationId={org.organizationId} permissions={org.permissions} />}
      </LiveGate>
    </section>
  );
}

function CommandCenter({
  organizationId,
  permissions,
}: {
  organizationId: string;
  permissions: readonly string[];
}) {
  const orgId = id<"organizations">(organizationId);
  const fleet = useQuery(
    api.telemetry.fleetSummary,
    permissions.includes("view.telemetry") ? { organizationId: orgId } : "skip",
  );
  const roster = useQuery(api.telemetry.siteRoster, { organizationId: orgId });

  const attention =
    roster?.filter(
      (row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0 || row.activeCommProblems > 0 || row.linkFail > 0,
    ) ?? [];

  return (
    <div className="stack cc-layout">
      {fleet === undefined && permissions.includes("view.telemetry") ? (
        <Skeleton lines={3} />
      ) : fleet?.ready ? (
        <StatusStrip
          title="Fleet"
          subtitle={
            (fleet.overallUnhealthy ?? 0) > 0 || (fleet.linkFail ?? 0) > 0
              ? "Attention required"
              : (fleet.gatewayOffline ?? 0) > 0
                ? "Degraded"
                : "Operational"
          }
          items={[
            { label: "Sites", value: String(fleet.sites) },
            { label: "Generators", value: String(fleet.generators) },
            { label: "Reporting", value: String(fleet.reporting) },
            {
              label: "Offline GW",
              value: String(fleet.gatewayOffline),
              tone: fleet.gatewayOffline > 0 ? "warn" : "ok",
            },
            {
              label: "Unhealthy",
              value: String(fleet.overallUnhealthy),
              tone: fleet.overallUnhealthy > 0 ? "alarm" : "ok",
            },
          ]}
          trailing={
            <Link to="/alarms" className="status-strip-pill tone-warn">
              Alarms
            </Link>
          }
        />
      ) : (
        <StatusStrip
          title="Fleet"
          subtitle="Unavailable"
          items={[
            { label: "Sites", value: roster ? String(roster.length) : "—" },
            { label: "Generators", value: "—" },
            { label: "Reporting", value: "—" },
          ]}
        />
      )}

      <QueryErrorBoundary title="Regional statistics unavailable">
        <RegionStats organizationId={orgId} />
      </QueryErrorBoundary>

      {attention.length > 0 ? (
        <section className="cc-attention" aria-label="Sites requiring attention">
          <header className="cc-section-head">
            <h2 className="cc-section-title">Attention</h2>
            <span className="meta">{attention.length}</span>
          </header>
          <DataTable
            dense
            rows={attention.slice(0, 8)}
            getRowKey={(row) => row.siteId}
            empty="No sites require attention."
            columns={[
              {
                key: "name",
                header: "Site",
                render: (row) => <Link to={`/sites/${row.siteId}`}>{row.name}</Link>,
              },
              {
                key: "status",
                header: "Issue",
                render: (row) =>
                  row.overallUnhealthy > 0 ? (
                    <StatusMark tone="alarm">Unhealthy</StatusMark>
                  ) : row.linkFail > 0 ? (
                    <StatusMark tone="alarm">Link fail</StatusMark>
                  ) : row.gatewayOffline > 0 ? (
                    <StatusMark tone="warn">Gateway offline</StatusMark>
                  ) : (
                    <StatusMark tone="warn">Comm</StatusMark>
                  ),
              },
              {
                key: "open",
                header: "",
                render: (row) => <Link to={`/sites/${row.siteId}`}>Open</Link>,
              },
            ]}
          />
        </section>
      ) : null}

      {roster === undefined ? (
        <Skeleton lines={8} />
      ) : roster.length === 0 ? (
        <EmptyState title="No sites" body="Provision a site from Sites." action={<Link to="/sites">Sites</Link>} />
      ) : (
        <section aria-label="Sites">
          <header className="cc-section-head">
            <h2 className="cc-section-title">Sites</h2>
            <Link to="/sites" className="meta">
              Manage
            </Link>
          </header>
          <DataTable
            dense
            rows={roster}
            getRowKey={(row) => row.siteId}
            empty="No sites"
            columns={[
              {
                key: "name",
                header: "Site",
                render: (row) => (
                  <span className="cc-site-cell">
                    <Link to={`/sites/${row.siteId}`}>{row.name}</Link>
                    {row.code ? <span className="meta tech">{row.code}</span> : null}
                  </span>
                ),
              },
              {
                key: "gw",
                header: "Gateway",
                render: (row) =>
                  row.gatewayOffline > 0 ? (
                    <StatusMark tone="warn">Offline</StatusMark>
                  ) : row.gatewayOnline > 0 ? (
                    <StatusMark tone="ok">Online</StatusMark>
                  ) : (
                    <StatusMark tone="offline">—</StatusMark>
                  ),
              },
              {
                key: "gens",
                header: "Gens",
                align: "right",
                render: (row) => String(row.generators ?? "—"),
              },
              {
                key: "status",
                header: "Status",
                render: (row) =>
                  row.overallUnhealthy > 0 || row.linkFail > 0 ? (
                    <StatusMark tone="alarm">Attention</StatusMark>
                  ) : row.gatewayOffline > 0 ? (
                    <StatusMark tone="warn">Degraded</StatusMark>
                  ) : row.reporting > 0 || row.gatewayOnline > 0 ? (
                    <StatusMark tone="ok">Operational</StatusMark>
                  ) : (
                    <StatusMark tone="offline">Idle</StatusMark>
                  ),
              },
            ]}
          />
        </section>
      )}
    </div>
  );
}
