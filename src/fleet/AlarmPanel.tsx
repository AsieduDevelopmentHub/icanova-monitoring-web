import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { accessMessage, id } from "./access";
import { FleetBoundary } from "./boundary";
import {
  canAcknowledge,
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
    return <p className="meta">Alarm records require view.alarms.</p>;
  }
  return (
    <FleetBoundary>
      <SiteAlarmBody organizationId={organizationId} siteId={siteId} />
    </FleetBoundary>
  );
}

function SiteAlarmBody({
  organizationId,
  siteId,
}: {
  organizationId: string;
  siteId: Id<"sites">;
}) {
  const data = useQuery(api.alarms.forSite, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
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
      <div className="metric-grid">
        <Metric label="Critical" value={String(summary.critical)} />
        <Metric label="Warning" value={String(summary.warning)} />
        <Metric label="Comm" value={String(summary.communication)} />
      </div>
      <DataTable
        caption="Recent alarm activity for this site"
        rows={summary.recent}
        getRowKey={(row) => row.id}
        empty="No alarm records are stored for this site."
        columns={[
          { key: "title", header: "Alarm", render: (row) => row.title },
          {
            key: "severity",
            header: "Severity",
            render: (row) => <StatusMark tone={severityTone(row.severity)}>{row.severity}</StatusMark>,
          },
          { key: "category", header: "Category", render: (row) => categoryLabel(row) },
          {
            key: "asset",
            header: "Asset",
            render: (row) =>
              row.generatorId ? (
                <Link to={`/generators/${row.generatorId}`}>{row.generatorName}</Link>
              ) : (
                row.generatorName || "—"
              ),
          },
          { key: "status", header: "Status", render: (row) => row.status },
          {
            key: "when",
            header: "Last seen",
            render: (row) => (
              <span className="tech">{new Date(row.lastOccurredAt).toISOString()}</span>
            ),
          },
          {
            key: "open",
            header: "",
            render: (row) => <Link to={`/alarms/${row.id}`}>Open</Link>,
          },
        ]}
      />
      <p className="meta">
        <Link to="/alarms">Alarm management</Link>
      </p>
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
  const acknowledge = useMutation(api.alarms.acknowledge);
  const [error, setError] = useState<string | null>(null);
  if (orgs === undefined) {
    return <Skeleton lines={5} />;
  }
  if (!allowed) {
    return <p className="meta">Alarm records require view.alarms.</p>;
  }
  if (data === undefined) {
    return <Skeleton lines={5} />;
  }
  const rows = (data.rows as StoredAlarmRow[]).map(toAlarmRecord);
  const open = rows.filter((row) => row.status === "active" || row.status === "acknowledged");
  const history = rows.filter((row) => row.status === "cleared" || row.status === "resolved");
  const allowAck = canAcknowledge(permissions);

  async function ack(alarmId: string) {
    setError(null);
    try {
      await acknowledge({ alarmId: id<"alarms">(alarmId) });
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <div className="stack">
      <h2>Alarms</h2>
      {data.capped ? <p className="meta">Latest 50 records.</p> : null}
      {open.length === 0 ? <p className="empty">No active alarms for this generator.</p> : null}
      <DataTable
        caption="Open alarms for this generator"
        rows={open}
        getRowKey={(row) => row.id}
        empty="No active alarms for this generator."
        columns={[
          { key: "title", header: "Alarm", render: (row) => row.title },
          {
            key: "severity",
            header: "Severity",
            render: (row) => <StatusMark tone={severityTone(row.severity)}>{row.severity}</StatusMark>,
          },
          { key: "category", header: "Category", render: (row) => categoryLabel(row) },
          { key: "status", header: "Status", render: (row) => row.status },
          {
            key: "ack",
            header: "Acknowledgement",
            render: (row) =>
              row.status === "active" && allowAck ? (
                <button type="button" onClick={() => void ack(row.id)}>
                  Acknowledge
                </button>
              ) : row.acknowledged ? (
                "Acknowledged"
              ) : (
                "Not acknowledged"
              ),
          },
          {
            key: "open",
            header: "",
            render: (row) => <Link to={`/alarms/${row.id}`}>Open</Link>,
          },
        ]}
      />
      <h3>Cleared history</h3>
      <DataTable
        caption="Cleared alarms for this generator"
        rows={history}
        getRowKey={(row) => row.id}
        empty="No cleared alarm history in this page."
        columns={[
          { key: "title", header: "Alarm", render: (row) => row.title },
          { key: "category", header: "Category", render: (row) => categoryLabel(row) },
          { key: "status", header: "Status", render: (row) => row.status },
        ]}
      />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
