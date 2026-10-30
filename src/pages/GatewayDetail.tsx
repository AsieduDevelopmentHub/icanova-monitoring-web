import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FleetBoundary } from "../fleet/boundary";
import { id } from "../fleet/access";
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
import { StatusMark } from "../ui/StatusMark";
import { DiagnosticPanel } from "./DiagnosticPanel";

const demoRows = demoDiagnostics(demoFrames, demoSamples);

export function GatewayDetail() {
  const { id: deviceId } = useParams();
  if (!deviceId) {
    return (
      <section className="page">
        <h1>Gateway</h1>
        <p>Missing id.</p>
      </section>
    );
  }
  if (deviceId === DEMO_GENERATOR_ID || !import.meta.env.VITE_CONVEX_URL) {
    if (deviceId !== DEMO_GENERATOR_ID) {
      return (
        <section className="page">
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
    <section className="page">
      <header className="page-head">
        <h1>{name}</h1>
        <p>
          <Link to="/gateways">Gateways</Link>
        </p>
      </header>
      <div className="notice fixture" role="note">
        <strong>Demo log.</strong> Frames and batch errors are from {DEMO_SOURCE}. Retries are not
        recorded in the excerpt. This is not a live Modbus session, and it cannot write to the
        controller.
      </div>
      <DiagnosticPanel
        rows={demoRows}
        sourceNote="TXN 43 prints CRC PASS and INVALID MODBUS FRAME together. Both lines stay. Time to first RX byte is the latency figure in the log."
      />
    </section>
  );
}

function StoredGateway({ deviceId }: { deviceId: string }) {
  const detail = useQuery(api.devices.detail, { deviceId: id<"devices">(deviceId) });
  const setLifecycle = useMutation(api.devices.setLifecycle);
  if (detail === undefined) {
    return (
      <section className="page">
        <p className="empty">Loading the device.</p>
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
  return (
    <section className="page">
      <header className="page-head">
        <h1>{detail.device.name}</h1>
        <p>
          <Link to="/gateways">Gateways</Link>
        </p>
      </header>
      <p className="meta">
        Identity {detail.device.identity}. Site {detail.siteName ?? "—"}. Lifecycle{" "}
        {active ? "active" : "inactive"}. Remote register writes and start/stop are not enabled on
        this page.
      </p>
      <div className="status-row">
        <StatusMark tone={active ? "ok" : "alarm"}>{active ? "Active" : "Inactive"}</StatusMark>
        <StatusMark tone={overall.tone}>{overall.label}</StatusMark>
        <StatusMark tone={gateway.tone}>Gateway {gateway.label}</StatusMark>
        <StatusMark tone={modbus.tone}>{modbus.label}</StatusMark>
        <StatusMark tone={fresh.tone}>{fresh.label}</StatusMark>
      </div>
      <p className="meta">
        Last heartbeat {contactAgeLabel(health?.lastHeartbeatAt, now)}. Last accepted batch{" "}
        {contactAgeLabel(health?.lastAcceptedBatchAt, now)}. Last telemetry{" "}
        {contactAgeLabel(health?.lastTelemetryAt, now)}.
      </p>
      <p>
        <button
          type="button"
          className="text-btn"
          onClick={() =>
            void setLifecycle({
              deviceId: id<"devices">(deviceId),
              lifecycle: active ? "inactive" : "active",
            })
          }
        >
          {active ? "Deactivate device" : "Reactivate device"}
        </button>
        {" · "}
        Deactivation stops ingest and heartbeat writes. Historical telemetry is kept.
      </p>
      <p>
        {poll
          ? `Last successful poll: ${poll.label}. Source time ${poll.at == null ? "—" : String(poll.at)}.`
          : "No successful poll is stored for this device."}
      </p>
      <FleetBoundary>
        <HealthEvents deviceId={deviceId} />
      </FleetBoundary>
      <h2>Generators</h2>
      {detail.generators.length === 0 ? (
        <p className="empty">No generator is linked to this device.</p>
      ) : (
        <ul>
          {detail.generators.map((generator) => (
            <li key={generator._id}>
              <Link to={`/generators/${generator._id}`}>{generator.name}</Link>
            </li>
          ))}
        </ul>
      )}
      <FleetBoundary>
        <StoredFrames deviceId={deviceId} />
      </FleetBoundary>
    </section>
  );
}

function HealthEvents({ deviceId }: { deviceId: string }) {
  const page = useQuery(api.deviceHealth.listEvents, {
    deviceId: id<"devices">(deviceId),
    paginationOpts: { numItems: 20, cursor: null },
  });
  if (page === undefined) {
    return <p className="empty">Loading health history.</p>;
  }
  if (page.page.length === 0) {
    return <p className="meta">No health transitions are stored yet.</p>;
  }
  return (
    <div className="stack">
      <h2>Health transitions</h2>
      <ul>
        {page.page.map((row) => (
          <li key={row._id}>
            {new Date(row.at).toISOString()} · {row.reason}
            {row.gatewayTo ? ` · gateway → ${row.gatewayTo}` : ""}
            {row.modbusTo ? ` · modbus → ${row.modbusTo}` : ""}
            {row.freshnessTo ? ` · freshness → ${row.freshnessTo}` : ""}
            {row.overallTo ? ` · overall → ${row.overallTo}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StoredFrames({ deviceId }: { deviceId: string }) {
  const data = useQuery(api.diagnostics.list, {
    deviceId: id<"devices">(deviceId),
    kind: "all",
    search: "",
  });
  if (data === undefined) {
    return <p className="empty">Loading diagnostics.</p>;
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
  );
}
