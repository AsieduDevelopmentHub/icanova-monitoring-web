import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { auditActor, auditTime } from "../telemetry/fleetView";
import { DataTable } from "../ui/DataTable";

type AuditRow = {
  _id: string;
  action: string;
  actorToken: string;
  target: string;
  at: number;
};

export function Events() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Events</h1>
        <p>Audit rows recorded for this organization. Telemetry updates are not listed here.</p>
      </header>
      <LiveGate>{(org) => <AuditList organizationId={org.organizationId} />}</LiveGate>
    </section>
  );
}

function AuditList({ organizationId }: { organizationId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const data = useQuery(api.audits.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor },
  });
  if (data === undefined) {
    return <p className="empty">Loading events.</p>;
  }
  const page = (Array.isArray(data.page) ? data.page : []) as AuditRow[];
  return (
    <div className="stack">
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
        <button type="button" className="text-btn" onClick={() => setCursor(data.continueCursor)}>
          Older events
        </button>
      ) : null}
    </div>
  );
}
