import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FleetBoundary } from "../fleet/boundary";
import type { Id } from "../../convex/_generated/dataModel";
import { demoFrames } from "../telemetry/demoLog";
import { DEMO_GENERATOR_ID, DEMO_SOURCE } from "../telemetry/logModel";
import {
  contactAgeLabel,
  freshnessView,
  gatewayView,
  modbusView,
  overallView,
} from "../telemetry/deviceHealthView";
import { DataTable } from "../ui/DataTable";
import { PageSkeleton, Skeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";
import { PageExport } from "../ui/PageExport";

export function GatewayDetail() {
  const { id: deviceId } = useParams();
  if (!deviceId) {
    return (
      <section className="page ops-page">
        <h1>Gateway</h1>
        <p>Missing id.</p>
      </section>
    );
  }
  if (deviceId === DEMO_GENERATOR_ID || !import.meta.env.VITE_CONVEX_URL) {
    if (deviceId !== DEMO_GENERATOR_ID) {
      return (
        <section className="page ops-page">
          <p className="meta">That id is not in the demo log.</p>
        </section>
      );
    }
    return <DemoGateway />;
  }
  return (
    <FleetBoundary key={deviceId}>
      <StoredGateway deviceId={deviceId} />
    </FleetBoundary>
  );
}

function DemoGateway() {
  const name = demoFrames[0]?.device ?? "DSE 7320 / 7320 MKII";
  return (
    <section className="page ops-page">
      <header className="page-identity">
        <div className="page-identity-main">
          <h1 className="page-identity-title">{name}</h1>
          <p className="meta">
            <Link to="/sites/demo">Site ID · demo</Link>
          </p>
        </div>
      </header>
      <p className="meta" role="note">
        Demo · {DEMO_SOURCE}
      </p>
      <section className="ops-section">
        <h2>Monitoring data</h2>
        <p className="empty">Gateway contact and firmware details are not included in this demo excerpt.</p>
      </section>
    </section>
  );
}

function StoredGateway({ deviceId }: { deviceId: string }) {
  const detail = useQuery(api.devices.detailForKey, { key: deviceId });
  if (detail === undefined) {
    return (
      <section className="page ops-page">
        <PageSkeleton rows={8} label="Loading gateway" />
      </section>
    );
  }
  const poll = detail.poll;
  const health = detail.health;
  const now = Date.now();
  const gateway = gatewayView(health?.gatewayStatus);
  const modbus = modbusView(health?.modbusStatus);
  const fresh = freshnessView(health?.telemetryFreshness);
  const overall = overallView(health?.overallStatus);
  const active = detail.device.lifecycle !== "inactive";
  const internalDeviceId = detail.device._id;

  return (
    <section className="page ops-page">
      <header className="page-identity">
        <div className="page-identity-main">
          <h1 className="page-identity-title">{detail.device.name}</h1>
        </div>
        <nav className="page-identity-actions" aria-label="Gateway monitoring shortcuts">
          {detail.device.siteId ? (
            <>
              <Link className="btn btn-secondary" to={`/sites/${detail.device.siteId}`}>
                Site ID · {detail.siteCode ?? detail.device.siteId}
              </Link>
              <Link className="btn btn-secondary" to={`/sites/${detail.device.siteId}?section=generators`}>
                Generators
              </Link>
              <Link className="btn btn-secondary" to={`/sites/${detail.device.siteId}?section=gateways`}>
                Gateways
              </Link>
              <Link className="btn btn-secondary" to={`/alarms?site=${detail.device.siteId}`}>Alarms</Link>
              <Link className="btn btn-secondary" to={`/events?site=${detail.device.siteId}`}>Events</Link>
            </>
          ) : (
            <>
              <Link className="btn btn-secondary" to="/alarms">Alarms</Link>
              <Link className="btn btn-secondary" to="/events">Events</Link>
            </>
          )}
        </nav>
        <PageExport
          title={`${detail.siteCode ?? detail.device.siteId ?? "gateway"} ${detail.device.name}`}
          headers={["Site ID", "Site", "Gateway", "Identity", "Status", "Cloud", "Modbus", "Telemetry", "Firmware", "Last contact"]}
          rows={[[
            detail.siteCode ?? String(detail.device.siteId ?? "N/A"),
            detail.siteName ?? "N/A",
            detail.device.name,
            detail.device.identity,
            active ? "Active" : "Inactive",
            gateway.label,
            modbus.label,
            fresh.label,
            health?.firmwareVersion ?? "N/A",
            contactAgeLabel(health?.lastGatewayContactAt, now),
          ]]}
        />
      </header>

      <div className="status-row">
        <StatusMark tone={active ? "ok" : "alarm"}>{active ? "Active" : "Inactive"}</StatusMark>
        <StatusMark tone={overall.tone}>{overall.label}</StatusMark>
        <StatusMark tone={gateway.tone}>Cloud {gateway.label}</StatusMark>
        <StatusMark tone={modbus.tone}>{modbus.label}</StatusMark>
        <StatusMark tone={fresh.tone}>{fresh.label}</StatusMark>
      </div>

      <div className="gateway-monitor-grid">
        <section className="ops-section" aria-labelledby="gw-identity-title">
          <h2 id="gw-identity-title">Gateway identity</h2>
          <dl className="facts">
            <dt>Identity</dt>
            <dd className="tech">{detail.device.identity}</dd>
            <dt>Site</dt>
            <dd>
              {detail.device.siteId ? (
                <Link to={`/sites/${detail.device.siteId}`}>{detail.siteName ?? "Site"}</Link>
              ) : (
                detail.siteName ?? "—"
              )}
            </dd>
            <dt>Firmware</dt>
            <dd className="tech">
              {health?.firmwareVersion
                ? `${health.firmwareVersion}${health.firmwareGit ? ` · ${health.firmwareGit}` : ""}`
                : "—"}
            </dd>
          </dl>
        </section>

        <section className="ops-section" aria-labelledby="gw-contact-title">
          <h2 id="gw-contact-title">Monitoring contact</h2>
          <dl className="facts">
            <dt>Heartbeat</dt>
            <dd>{contactAgeLabel(health?.lastHeartbeatAt, now)}</dd>
            <dt>Accepted batch</dt>
            <dd>{contactAgeLabel(health?.lastAcceptedBatchAt, now)}</dd>
            <dt>Gateway contact</dt>
            <dd>{contactAgeLabel(health?.lastGatewayContactAt, now)}</dd>
            <dt>Telemetry</dt>
            <dd>{contactAgeLabel(health?.lastTelemetryAt, now)}</dd>
            <dt>Last poll</dt>
            <dd>{poll ? `${poll.label}${poll.at == null ? "" : ` · ${poll.at}`}` : "—"}</dd>
          </dl>
        </section>
      </div>

      <section className="ops-section" aria-labelledby="gw-equipment-title">
        <h2 id="gw-equipment-title">Monitored generators</h2>
        {detail.generators.length === 0 ? (
          <p className="empty">No generators linked.</p>
        ) : (
          <DataTable
            dense
            caption="Linked generators"
            exportTitle="Linked generators"
            rows={detail.generators}
            getRowKey={(row) => row._id}
            empty="No generators linked."
            columns={[
              {
                key: "name",
                header: "Generator",
                render: (row: { _id: string; name: string; code?: string | null }) =>
                  detail.device.siteId ? (
                    <Link to={`/sites/${detail.device.siteId}/generators/${row.code ?? row._id}`}>
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  ),
              },
              {
                key: "open",
                header: "",
                render: (row: { _id: string }) =>
                  detail.device.siteId ? (
                    <Link to={`/trends?site=${detail.device.siteId}&generator=${row._id}`}>Trends</Link>
                  ) : (
                    <Link to={`/trends?generator=${row._id}`}>Trends</Link>
                  ),
              },
            ]}
          />
        )}
      </section>

      <FleetBoundary>
        <HealthEvents deviceId={internalDeviceId} />
      </FleetBoundary>
    </section>
  );
}

function HealthEvents({ deviceId }: { deviceId: Id<"devices"> }) {
  const page = useQuery(api.deviceHealth.listEvents, {
    deviceId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  if (page === undefined) {
    return <Skeleton lines={5} />;
  }
  return (
    <section className="ops-section" aria-labelledby="gw-activity-title">
      <h2 id="gw-activity-title">Activity</h2>
      {page.page.length === 0 ? (
        <p className="empty">No health transitions are stored yet.</p>
      ) : (
        <DataTable
          caption="Health transitions"
          exportTitle="Gateway health transitions"
          rows={page.page}
          getRowKey={(row) => row._id}
          empty="No health transitions are stored yet."
          columns={[
            {
              key: "at",
              header: "When",
              render: (row) => <span className="tech">{new Date(row.at).toISOString()}</span>,
            },
            { key: "reason", header: "Reason", render: (row) => row.reason },
            {
              key: "change",
              header: "Change",
              render: (row) => {
                const parts = [
                  row.gatewayTo ? `gateway → ${row.gatewayTo}` : null,
                  row.modbusTo ? `modbus → ${row.modbusTo}` : null,
                  row.freshnessTo ? `freshness → ${row.freshnessTo}` : null,
                  row.overallTo ? `overall → ${row.overallTo}` : null,
                ].filter(Boolean);
                return parts.length > 0 ? parts.join(" · ") : "—";
              },
            },
          ]}
        />
      )}
    </section>
  );
}
