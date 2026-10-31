import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import {
  canViewOpsOverview,
  permissionDeniedNotice,
  unsignedNotice,
} from "../fleet/sessionGates";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";

type Denied = { denied: true; required: string; note: string };

function isDenied(section: unknown): section is Denied {
  return Boolean(
    section &&
      typeof section === "object" &&
      "denied" in section &&
      (section as { denied: boolean }).denied,
  );
}

function asRecord(section: unknown): Record<string, any> {
  return section as Record<string, any>;
}

export function Ops() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Operations</h1>
        <p>
          Platform observability for authorized operators. Each section requires its own permission.
          Gateway, Modbus, freshness and engine stay separate. Missing is not zero.
        </p>
      </header>
      {import.meta.env.VITE_CONVEX_URL ? (
        <SignedOps />
      ) : (
        <p className="empty">Convex is not configured.</p>
      )}
    </section>
  );
}

function SignedOps() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return <p className="empty">Checking session…</p>;
  }
  if (!isAuthenticated) {
    const notice = unsignedNotice("No operational query is running.");
    return (
      <div className="notice" role="note">
        <strong>{notice.title}</strong> {notice.detail}
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
  const org = orgs[0];
  if (!canViewOpsOverview(org.permissions)) {
    const notice = permissionDeniedNotice("Operational overview");
    return (
      <div className="notice" role="note">
        <strong>{notice.title}</strong> {notice.detail}
      </div>
    );
  }
  return (
    <FleetBoundary key={org.organizationId}>
      <Overview organizationId={org.organizationId} orgName={org.name} />
    </FleetBoundary>
  );
}

function SectionDenied({ title, section }: { title: string; section: { required: string; note: string } }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="notice" role="note">
        <strong>Permission denied.</strong> Requires <code>{section.required}</code>. {section.note}
      </div>
    </>
  );
}

function Overview({ organizationId, orgName }: { organizationId: string; orgName: string }) {
  const data = useQuery(api.ops.overview, {
    organizationId: id<"organizations">(organizationId),
  });
  if (data === undefined) {
    return <p className="empty">Loading operational overview.</p>;
  }

  return (
    <div className="stack">
      <p className="meta">
        Organization {orgName}. Sections are independent. {data.dimensionsNote}
      </p>

      {isDenied(data.fleet) ? (
        <SectionDenied title="Fleet health" section={data.fleet} />
      ) : (
        (() => {
          const fleet = asRecord(data.fleet);
          return (
            <>
              <h2>Fleet health</h2>
              {!fleet.ready ? (
                <p className="empty">
                  No fleet health summary yet. It appears after the first heartbeat or ingest.
                </p>
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
            </>
          );
        })()
      )}

      {isDenied(data.ingest) ? (
        <SectionDenied title="Ingestion (current hour)" section={data.ingest} />
      ) : (
        (() => {
          const org = asRecord(data.ingest).organization as Record<string, any>;
          return (
            <>
              <h2>Ingestion (current hour)</h2>
              <div className="metric-grid">
                <Metric label="Accepted batches" value={String(org.accepted)} />
                <Metric label="Heartbeats ok" value={String(org.heartbeatOk)} />
                <Metric label="Duplicates / stale" value={String(org.duplicate)} />
                <Metric label="Inactive rejects" value={String(org.inactive)} />
                <Metric label="Rate limited" value={String(org.rateLimited)} />
                <Metric label="Auth failed" value={String(org.authFailed)} note="Global auth may dominate" />
                <Metric label="Invalid / oversized" value={String(org.invalid + org.oversized)} />
                <Metric
                  label="Last accepted"
                  value={org.lastAcceptedAt ? new Date(org.lastAcceptedAt).toISOString() : "—"}
                />
                <Metric
                  label="Last ingest error"
                  value={
                    org.lastErrorAt
                      ? `${org.lastErrorKind ?? "error"} @ ${new Date(org.lastErrorAt).toISOString()}`
                      : "—"
                  }
                />
              </div>
            </>
          );
        })()
      )}

      {isDenied(data.jobs) ? (
        <SectionDenied title="Scheduled jobs" section={data.jobs} />
      ) : (
        (() => {
          const jobs = data.jobs as Array<Record<string, any>>;
          return (
            <>
              <h2>Scheduled jobs</h2>
              <div className="metric-grid">
                <Metric label="Jobs reporting" value={String(jobs.length)} />
                <Metric
                  label="Ok / partial"
                  value={String(jobs.filter((j) => j.status === "ok" || j.status === "partial").length)}
                />
                <Metric label="Failed" value={String(jobs.filter((j) => j.status === "failed").length)} />
                <Metric
                  label="Stale hint"
                  value={String(jobs.filter((j) => j.stale).length)}
                  note="No recent attempt while pending"
                />
              </div>
              {jobs.length === 0 ? (
                <p className="empty">
                  No job runs recorded yet. Cron ticks populate this after the first interval.
                </p>
              ) : (
                <ul>
                  {jobs.map((job) => (
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
            </>
          );
        })()
      )}

      {isDenied(data.notifications) ? (
        <SectionDenied title="Notifications (recent sample)" section={data.notifications} />
      ) : (
        (() => {
          const notifications = asRecord(data.notifications);
          return (
            <>
              <h2>Notifications (recent sample)</h2>
              <p className="meta">{notifications.note}</p>
              <div className="metric-grid">
                <Metric label="Pending" value={String(notifications.pending)} />
                <Metric label="Sent" value={String(notifications.sent)} />
                <Metric label="Failed" value={String(notifications.failed)} />
                <Metric
                  label="Uncertain"
                  value={String(notifications.uncertain)}
                  note="Not auto-duplicated"
                />
                <Metric label="Email sent (sample)" value={String(notifications.emailSent)} />
                <Metric label="SMS sent (sample)" value={String(notifications.smsSent)} />
              </div>
            </>
          );
        })()
      )}

      {isDenied(data.alarms) ? (
        <SectionDenied title="Alarms" section={data.alarms} />
      ) : (
        (() => {
          const alarms = asRecord(data.alarms);
          return (
            <>
              <h2>Alarms</h2>
              <Metric
                label="Active/ack in recent page"
                value={String(alarms.activeOrAckInRecentPage)}
                note={alarms.note}
              />
            </>
          );
        })()
      )}

      {isDenied(data.audit) ? (
        <SectionDenied title="Audit sample" section={data.audit} />
      ) : (
        (() => {
          const audit = asRecord(data.audit);
          const rows = (audit.rows ?? []) as Array<{ action: string; target: string; at: number }>;
          return (
            <>
              <h2>Audit sample</h2>
              <p className="meta">{audit.note}</p>
              {rows.length === 0 ? (
                <p className="empty">No audit rows yet.</p>
              ) : (
                <ul>
                  {rows.map((row, index) => (
                    <li key={`${row.at}-${index}`}>
                      {row.action} · {row.target} · {new Date(row.at).toISOString()}
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
