import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { auditActor, auditTime } from "../telemetry/fleetView";
import { DataTable } from "../ui/DataTable";
import { Tabs } from "../ui/Tabs";

type AuditRow = {
  _id: string;
  action: string;
  actorToken: string;
  target: string;
  at: number;
};

type TimelineMode = "health" | "audit";

export function Events() {
  const [mode, setMode] = useState<TimelineMode>("health");
  return (
    <section className="page">
      <header className="page-head">
        <h1>Event timeline</h1>
        <p>
          Stored health transitions and organization audit actions — not an invented uptime feed.
        </p>
      </header>
      <Tabs
        label="Timeline source"
        value={mode}
        onChange={setMode}
        items={[
          { id: "health", label: "Health transitions" },
          { id: "audit", label: "Audit log" },
        ]}
      />
      <LiveGate>
        {(org) =>
          mode === "health" ? (
            <SiteSelect organizationId={org.organizationId}>
              {(siteId, siteName) => (
                <FleetBoundary key={siteId}>
                  <HealthTimeline organizationId={org.organizationId} siteId={siteId} siteName={siteName} />
                </FleetBoundary>
              )}
            </SiteSelect>
          ) : (
            <AuditList organizationId={org.organizationId} />
          )
        }
      </LiveGate>
    </section>
  );
}

function HealthTimeline({
  organizationId,
  siteId,
  siteName,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
}) {
  const data = useQuery(api.deviceHealth.recentForSite, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
  if (data === undefined) {
    return <p className="empty">Loading health timeline.</p>;
  }
  return (
    <div className="stack">
      <p className="meta">
        Site <strong>{siteName}</strong>. Stored health transitions (heartbeat, ingest, sweep) for
        about 14 days. Cloud Online/Offline changes appear here when recorded — this is not a
        calculated availability percentage.
        {data.capped ? " Newest page only." : ""}
      </p>
      <DataTable
        caption={`Health transitions at ${siteName}`}
        rows={data.rows}
        getRowKey={(row) => row._id}
        empty="No health transitions are stored for this site yet."
        columns={[
          {
            key: "at",
            header: "When (UTC)",
            render: (row) => <span className="tech">{new Date(row.at).toISOString()}</span>,
          },
          {
            key: "device",
            header: "Gateway",
            render: (row) => <Link to={`/gateways/${row.deviceId}`}>{row.deviceName}</Link>,
          },
          {
            key: "identity",
            header: "Identity",
            render: (row) =>
              row.deviceIdentity ? <span className="tech">{row.deviceIdentity}</span> : "—",
          },
          { key: "reason", header: "Reason", render: (row) => row.reason },
          {
            key: "change",
            header: "Change",
            render: (row) => {
              const parts = [
                row.gatewayTo ? `cloud → ${row.gatewayTo}` : null,
                row.modbusTo ? `modbus → ${row.modbusTo}` : null,
                row.freshnessTo ? `freshness → ${row.freshnessTo}` : null,
                row.overallTo ? `overall → ${row.overallTo}` : null,
              ].filter(Boolean);
              return parts.length > 0 ? parts.join(" · ") : "—";
            },
          },
        ]}
      />
      <p className="meta">
        <Link to="/gateways">Gateway inventory</Link>
        {" · "}
        <Link to="/reports">Export reports</Link>
      </p>
    </div>
  );
}

function AuditList({ organizationId }: { organizationId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const data = useQuery(api.audits.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor },
  });
  if (data === undefined) {
    return <p className="empty">Loading audit events.</p>;
  }
  const page = (Array.isArray(data.page) ? data.page : []) as AuditRow[];
  return (
    <div className="stack">
      <p className="meta">
        Operator and system audit rows for this organization. Telemetry samples and raw Modbus frames
        are not listed here.
      </p>
      <DataTable
        caption="Organization audit history"
        rows={page}
        getRowKey={(row) => row._id}
        empty="No audit events are stored for this organization."
        columns={[
          { key: "time", header: "Time", render: (row) => auditTime(row.at) },
          { key: "action", header: "Action", render: (row) => row.action },
          { key: "actor", header: "Actor", render: (row) => auditActor(row.actorToken) },
          { key: "target", header: "Resource", render: (row) => row.target },
        ]}
      />
      {data.isDone === false && data.continueCursor ? (
        <button type="button" className="btn btn-secondary" onClick={() => setCursor(data.continueCursor)}>
          Older events
        </button>
      ) : null}
    </div>
  );
}
