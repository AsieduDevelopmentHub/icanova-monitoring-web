import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import { useBearerToken } from "../fleet/useBearer";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";

export function Ops() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Operations</h1>
        <p>
          Platform observability for authorized operators. Gateway, Modbus, freshness and engine
          stay separate. Missing is not zero.
        </p>
      </header>
      {import.meta.env.VITE_CONVEX_URL ? <SignedOps /> : <p className="empty">Convex is not configured.</p>}
    </section>
  );
}

function SignedOps() {
  const token = useBearerToken();
  if (!token) {
    return (
      <div className="notice" role="note">
        <strong>Not signed in.</strong> No operational query is running.
      </div>
    );
  }
  return (
    <FleetBoundary>
      <OpsBoard />
    </FleetBoundary>
  );
}

function OpsBoard() {
  const orgs = useQuery(api.organizations.mine, {});
  if (orgs === undefined) {
    return <p className="empty">Loading organizations.</p>;
  }
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return <p className="empty">This account has no organization membership.</p>;
  }
  const organizationId = orgs[0].organizationId;
  return (
    <FleetBoundary key={organizationId}>
      <Overview organizationId={organizationId} orgName={orgs[0].name} />
    </FleetBoundary>
  );
}

function Overview({ organizationId, orgName }: { organizationId: string; orgName: string }) {
  const data = useQuery(api.ops.overview, {
    organizationId: id<"organizations">(organizationId),
  });
  if (data === undefined) {
    return <p className="empty">Loading operational overview.</p>;
  }
  const fleet = data.fleet;
  const ingest = data.ingest.organization;
  const jobsOk = data.jobs.filter((j) => j.status === "ok" || j.status === "partial").length;
  const jobsStale = data.jobs.filter((j) => j.stale).length;
  const jobsFailed = data.jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="stack">
      <p className="meta">
        Organization {orgName}. Incremental fleet tallies and the current ingest hour.{" "}
        {data.dimensionsNote}
      </p>

      <h2>Fleet health</h2>
      {!fleet.ready ? (
        <p className="empty">No fleet health summary yet. It appears after the first heartbeat or ingest.</p>
      ) : (
        <div className="metric-grid">
          <Metric label="Tracked devices" value={String(fleet.devicesTracked)} />
          <Metric
            label="Active devices"
            value={fleet.devicesActive === null ? "—" : String(fleet.devicesActive)}
            note="Null means the counter was not backfilled"
          />
          <Metric
            label="Inactive devices"
            value={fleet.devicesInactive === null ? "—" : String(fleet.devicesInactive)}
          />
          <Metric label="Gateways online" value={String(fleet.gatewayOnline)} note="Cloud contact" />
          <Metric label="Gateways offline" value={String(fleet.gatewayOffline)} />
          <Metric label="Gateways unknown" value={String(fleet.gatewayUnknown)} />
          <Metric label="Modbus ok" value={String(fleet.modbusOk)} note="Sample link" />
          <Metric label="Modbus fail" value={String(fleet.modbusFail)} />
          <Metric label="Telemetry fresh" value={String(fleet.telemetryFresh)} />
          <Metric label="Telemetry stale" value={String(fleet.telemetryStale)} />
          <Metric label="Telemetry missing" value={String(fleet.telemetryMissing)} />
          <Metric label="Comm problems" value={String(fleet.activeCommProblems)} />
        </div>
      )}

      <h2>Ingestion (current hour)</h2>
      <div className="metric-grid">
        <Metric label="Accepted batches" value={String(ingest.accepted)} />
        <Metric label="Heartbeats ok" value={String(ingest.heartbeatOk)} />
        <Metric label="Duplicates / stale" value={String(ingest.duplicate)} />
        <Metric label="Inactive rejects" value={String(ingest.inactive)} />
        <Metric label="Rate limited" value={String(ingest.rateLimited)} />
        <Metric label="Auth failed" value={String(ingest.authFailed)} note="Global auth may dominate" />
        <Metric label="Invalid / oversized" value={String(ingest.invalid + ingest.oversized)} />
        <Metric
          label="Last accepted"
          value={ingest.lastAcceptedAt ? new Date(ingest.lastAcceptedAt).toISOString() : "—"}
        />
        <Metric
          label="Last ingest error"
          value={
            ingest.lastErrorAt
              ? `${ingest.lastErrorKind ?? "error"} @ ${new Date(ingest.lastErrorAt).toISOString()}`
              : "—"
          }
        />
      </div>

      <h2>Scheduled jobs</h2>
      <div className="metric-grid">
        <Metric label="Jobs reporting" value={String(data.jobs.length)} />
        <Metric label="Ok / partial" value={String(jobsOk)} />
        <Metric label="Failed" value={String(jobsFailed)} />
        <Metric label="Stale hint" value={String(jobsStale)} note="No recent attempt while pending" />
      </div>
      {data.jobs.length === 0 ? (
        <p className="empty">No job runs recorded yet. Cron ticks populate this after the first interval.</p>
      ) : (
        <ul>
          {data.jobs.map((job) => (
            <li key={job.jobName}>
              <StatusMark tone={job.status === "failed" ? "alarm" : job.stale ? "warn" : "ok"}>
                {job.jobName}
              </StatusMark>{" "}
              {job.status} · processed {job.processed}
              {job.lastError ? ` · ${job.lastError}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h2>Notifications (recent sample)</h2>
      <p className="meta">{data.notifications.note}</p>
      <div className="metric-grid">
        <Metric label="Pending" value={String(data.notifications.pending)} />
        <Metric label="Sent" value={String(data.notifications.sent)} />
        <Metric label="Failed" value={String(data.notifications.failed)} />
        <Metric label="Uncertain" value={String(data.notifications.uncertain)} note="Not auto-duplicated" />
        <Metric label="Email sent (sample)" value={String(data.notifications.emailSent)} />
        <Metric label="SMS sent (sample)" value={String(data.notifications.smsSent)} />
      </div>

      <h2>Alarms</h2>
      <Metric
        label="Active/ack in recent page"
        value={String(data.alarms.activeOrAckInRecentPage)}
        note={data.alarms.note}
      />
    </div>
  );
}
