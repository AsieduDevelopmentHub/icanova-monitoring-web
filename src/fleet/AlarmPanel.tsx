import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { id } from "./access";
import { FleetBoundary } from "./boundary";
import { AlarmPeek } from "./AlarmPeek";
import {
  categoryLabel,
  severityTone,
  siteAlarmSummary,
  toAlarmRecord,
  type StoredAlarmRow,
} from "../telemetry/alarmCenter";
import { DataTable } from "../ui/DataTable";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import { useState } from "react";
import { Skeleton } from "../ui/Skeleton";

export function SiteAlarmPanel({
  organizationId,
  siteId,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  permissions: readonly string[];
}) {
  if (!permissions.includes("view.alarms")) {
    return null;
  }
  return (
    <FleetBoundary>
      <SiteAlarmBody organizationId={organizationId} siteId={siteId} permissions={permissions} />
    </FleetBoundary>
  );
}

function SiteAlarmBody({
  organizationId,
  siteId,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  permissions: readonly string[];
}) {
  const data = useQuery(api.alarms.forSite, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
  const [peekId, setPeekId] = useState<string | null>(null);
  if (data === undefined) {
    return <Skeleton lines={5} />;
  }
  const summary = siteAlarmSummary(
    (data.rows as StoredAlarmRow[]).map(toAlarmRecord),
    Boolean(data.capped),
  );
  return (
    <section className="ops-section stack" aria-labelledby="ops-alarms-title">
      <h2 id="ops-alarms-title">Alarms</h2>
      {summary.banner ? <p className="empty">{summary.banner}</p> : null}
      <div className="metric-grid metric-grid-3">
        <Metric label="Critical" value={String(summary.critical)} />
        <Metric label="Warning" value={String(summary.warning)} />
        <Metric label="Comm" value={String(summary.communication)} />
      </div>
      <DataTable
        dense
        caption="Site alarms"
        rows={summary.recent}
        getRowKey={(row) => row.id}
        empty="No alarm records for this site."
        columns={[
          {
            key: "severity",
            header: "Severity",
            render: (row) => <StatusMark tone={severityTone(row.severity)}>{row.severity}</StatusMark>,
          },
          {
            key: "title",
            header: "Alarm",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                {row.title}
              </button>
            ),
          },
          { key: "category", header: "Category", render: (row) => categoryLabel(row) },
          {
            key: "asset",
            header: "Asset",
            render: (row) =>
              row.generatorId && siteId ? (
                <Link to={`/sites/${siteId}/generators/${row.generatorId}`}>{row.generatorName}</Link>
              ) : (
                row.generatorName || "—"
              ),
          },
          { key: "status", header: "Status", render: (row) => row.status },
          {
            key: "open",
            header: "",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                Inspect
              </button>
            ),
          },
        ]}
      />
      <AlarmPeek alarmId={peekId} permissions={permissions} onClose={() => setPeekId(null)} />
    </section>
  );
}

export function GeneratorAlarms({
  generatorId,
  organizationId,
}: {
  generatorId: string;
  organizationId: string;
}) {
  const orgs = useQuery(api.organizations.mine, {});
  const permissions =
    orgs?.find((org) => org.organizationId === organizationId)?.permissions ?? [];
  const allowed = permissions.includes("view.alarms");
  const data = useQuery(
    api.alarms.forGenerator,
    allowed ? { generatorId: id<"generators">(generatorId) } : "skip",
  );
  const [peekId, setPeekId] = useState<string | null>(null);
  if (orgs === undefined) {
    return <Skeleton lines={5} />;
  }
  if (!allowed) {
    return null;
  }
  if (data === undefined) {
    return <Skeleton lines={5} />;
  }
  const rows = (data.rows as StoredAlarmRow[]).map(toAlarmRecord);
  const open = rows.filter((row) => row.status === "active" || row.status === "acknowledged");
  const history = rows.filter((row) => row.status === "cleared" || row.status === "resolved");

  return (
    <div className="stack">
      {data.capped ? <p className="meta">Latest 50.</p> : null}
      <DataTable
        dense
        caption="Open alarms"
        rows={open}
        getRowKey={(row) => row.id}
        empty="No active alarms."
        columns={[
          {
            key: "severity",
            header: "Severity",
            render: (row) => <StatusMark tone={severityTone(row.severity)}>{row.severity}</StatusMark>,
          },
          {
            key: "title",
            header: "Alarm",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                {row.title}
              </button>
            ),
          },
          { key: "category", header: "Category", render: (row) => categoryLabel(row) },
          { key: "status", header: "Status", render: (row) => row.status },
          {
            key: "open",
            header: "",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                Inspect
              </button>
            ),
          },
        ]}
      />
      <details>
        <summary>Cleared history</summary>
        <DataTable
          dense
          caption="Cleared"
          rows={history}
          getRowKey={(row) => row.id}
          empty="No cleared history."
          columns={[
            {
              key: "title",
              header: "Alarm",
              render: (row) => (
                <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                  {row.title}
                </button>
              ),
            },
            { key: "category", header: "Category", render: (row) => categoryLabel(row) },
            { key: "status", header: "Status", render: (row) => row.status },
          ]}
        />
      </details>
      <AlarmPeek alarmId={peekId} permissions={permissions} onClose={() => setPeekId(null)} />
    </div>
  );
}
