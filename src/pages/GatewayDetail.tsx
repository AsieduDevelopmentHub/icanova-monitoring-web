import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FleetBoundary } from "../fleet/boundary";
import type { Id } from "../../convex/_generated/dataModel";
import { accessMessage } from "../fleet/access";
import { demoFrames, demoSamples } from "../telemetry/demoLog";
import { demoDiagnostics } from "../telemetry/diagnosticsView";
import { DEMO_GENERATOR_ID, DEMO_SOURCE } from "../telemetry/logModel";
import {
  contactAgeLabel,
  freshnessView,
  gatewayView,
  modbusView,
  overallView,
} from "../telemetry/deviceHealthView";
import { Button } from "../ui/Button";
import { DataTable } from "../ui/DataTable";
import { PageSkeleton, Skeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";
import { DiagnosticPanel } from "./DiagnosticPanel";

const demoRows = demoDiagnostics(demoFrames, demoSamples);

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
          <header className="page-head">
            <h1>Gateway</h1>
            <p>That id is not in the demo log.</p>
          </header>
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
      <header className="page-head">
        <h1>{name}</h1>
        <p>
          <Link to="/gateways">Gateways</Link>
        </p>
      </header>
      <p className="meta" role="note">
        Demo · {DEMO_SOURCE}
      </p>
      <DiagnosticPanel
        rows={demoRows}
        sourceNote="TXN 43 prints CRC PASS and INVALID MODBUS FRAME together. Both lines stay. Time to first RX byte is the latency figure in the log."
      />
    </section>
  );
}

function StoredGateway({ deviceId }: { deviceId: string }) {
  const detail = useQuery(api.devices.detailForKey, { key: deviceId });
  const setLifecycle = useMutation(api.devices.setLifecycle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function onLifecycle() {
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      await setLifecycle({
        deviceId: internalDeviceId,
        lifecycle: active ? "inactive" : "active",
      });
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="page ops-page">
      <header className="page-head">
        <div>
          <p className="crumb-row meta">
            <Link to="/app">Command Center</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/gateways">Gateways</Link>
            <span aria-hidden="true"> / </span>
            <span>{detail.device.name}</span>
          </p>
          <h1>{detail.device.name}</h1>
          <p className="meta">
            {detail.device.siteId ? (
              <>
                <Link to={`/sites/${detail.device.siteId}`}>{detail.siteName ?? "Site"}</Link>
                {" · "}
              </>
            ) : null}
            <Link to={`/alarms?device=${detail.device._id}`}>Alarms</Link>
            {" · "}
            <Link to="/events">Events</Link>
          </p>
        </div>
      </header>

      <div className="status-row">
        <StatusMark tone={active ? "ok" : "alarm"}>{active ? "Active" : "Inactive"}</StatusMark>
        <StatusMark tone={overall.tone}>{overall.label}</StatusMark>
        <StatusMark tone={gateway.tone}>Cloud {gateway.label}</StatusMark>
        <StatusMark tone={modbus.tone}>{modbus.label}</StatusMark>
        <StatusMark tone={fresh.tone}>{fresh.label}</StatusMark>
      </div>

      <section className="ops-section" aria-labelledby="gw-identity-title">
        <h2 id="gw-identity-title">Identity</h2>
        <dl className="facts">
          <dt>Identity</dt>
          <dd className="tech">{detail.device.identity}</dd>
          <dt>Site</dt>
          <dd>
            {detail.device.siteId ? (
              <Link to={`/sites/${detail.device.siteId}`}>{detail.siteName ?? "Site"}</Link>
            ) : (
              (detail.siteName ?? "—")
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
        <h2 id="gw-contact-title">Contact</h2>
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
        <div className="btn-row">
          <Button variant="secondary" disabled={pending} onClick={() => void onLifecycle()}>
            {pending ? "Updating…" : active ? "Deactivate" : "Reactivate"}
          </Button>
          <Link className="btn btn-secondary" to="/local/configure">
            Configure
          </Link>
        </div>
        {error ? <p className="err">{error}</p> : null}
      </section>

      <section className="ops-section" aria-labelledby="gw-equipment-title">
        <h2 id="gw-equipment-title">Equipment</h2>
        {detail.generators.length === 0 ? (
          <p className="empty">No generators linked.</p>
        ) : (
          <DataTable
            dense
            caption="Linked generators"
            rows={detail.generators}
            getRowKey={(row) => row._id}
            empty="No generators linked."
            columns={[
              {
                key: "name",
                header: "Generator",
                render: (row: { _id: string; name: string; code?: string | null }) => (
                  <Link to={`/generators/${row.code ?? row._id}`}>{row.name}</Link>
                ),
              },
              {
                key: "open",
                header: "",
                render: (row: { _id: string }) => (
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
      <FleetBoundary>
        <StoredFrames deviceId={internalDeviceId} />
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

function StoredFrames({ deviceId }: { deviceId: Id<"devices"> }) {
  const data = useQuery(api.diagnostics.list, {
    deviceId,
    kind: "all",
    search: "",
  });
  if (data === undefined) {
    return <Skeleton lines={5} />;
  }
  const rows = [...data.rows].reverse().map((row) => ({
    key: row._id,
    kind: row.kind,
    txn: row.txn,
    functionCode: row.functionCode,
    address: row.address,
    quantity: row.quantity,
    tx: row.tx,
    rx: row.rx,
    rxLength: row.rxLength,
    receivedCrc: row.receivedCrc,
    calculatedCrc: row.calculatedCrc,
    crcResult: row.crcResult,
    result: row.result,
    latencyMs: row.latencyMs,
    retries: row.retries,
    note: row.note,
  }));
  return (
    <section className="ops-section" aria-labelledby="gw-diag-title">
      <h2 id="gw-diag-title">Diagnostics</h2>
      <DiagnosticPanel
        rows={rows}
        chronological={false}
        successNote="The last successful poll is the line above. CRC PASS with an invalid frame does not update it. Retries stay blank when the record has none."
        sourceNote={
          data.capped
            ? "This table is the newest 200 stored records. Search and kind filters apply to that page."
            : "Stored frames for this device. An empty list means nothing has been recorded. The demo log is a separate device."
        }
      />
    </section>
  );
}
