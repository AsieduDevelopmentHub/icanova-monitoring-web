import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FleetBoundary } from "../fleet/boundary";
import { accessMessage, id } from "../fleet/access";
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
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (detail === undefined) {
    return (
      <section className="page">
        <Skeleton lines={8} />
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

  async function onLifecycle() {
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      await setLifecycle({
        deviceId: id<"devices">(deviceId),
        lifecycle: active ? "inactive" : "active",
      });
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>{detail.device.name}</h1>
        <p>
          <Link to="/gateways">Gateways</Link>
          {" · "}
          <Link to="/app">Dashboard</Link>
        </p>
      </header>

      <Panel title="Identity">
        <dl className="facts">
          <dt>Product</dt>
          <dd>iCanOva Edge Gateway</dd>
          <dt>Identity</dt>
          <dd className="tech">{detail.device.identity}</dd>
          <dt>Site</dt>
          <dd>{detail.siteName ?? "—"}</dd>
          <dt>Lifecycle</dt>
          <dd>{active ? "active" : "inactive"}</dd>
          <dt>Firmware version</dt>
          <dd>Not stored in this deployment</dd>
        </dl>
        <div className="status-row">
          <StatusMark tone={active ? "ok" : "alarm"}>{active ? "Active" : "Inactive"}</StatusMark>
          <StatusMark tone={overall.tone}>{overall.label}</StatusMark>
          <StatusMark tone={gateway.tone}>Cloud {gateway.label}</StatusMark>
          <StatusMark tone={modbus.tone}>{modbus.label}</StatusMark>
          <StatusMark tone={fresh.tone}>{fresh.label}</StatusMark>
        </div>
      </Panel>

      <Panel title="Connectivity">
        <dl className="facts">
          <dt>Last heartbeat</dt>
          <dd>{contactAgeLabel(health?.lastHeartbeatAt, now)}</dd>
          <dt>Last accepted batch</dt>
          <dd>{contactAgeLabel(health?.lastAcceptedBatchAt, now)}</dd>
          <dt>Last gateway contact</dt>
          <dd>{contactAgeLabel(health?.lastGatewayContactAt, now)}</dd>
          <dt>Last telemetry</dt>
          <dd>{contactAgeLabel(health?.lastTelemetryAt, now)}</dd>
          <dt>Last successful poll</dt>
          <dd>
            {poll
              ? `${poll.label} · source time ${poll.at == null ? "—" : String(poll.at)}`
              : "No successful poll is stored for this device."}
          </dd>
        </dl>
        <p>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void onLifecycle()}
          >
            {pending ? "Updating…" : active ? "Deactivate device" : "Reactivate device"}
          </Button>
        </p>
        {error ? <p className="err">{error}</p> : null}
      </Panel>

      <Panel title="Configuration">
        <p className="meta">Modbus and Soft-AP settings apply on the gateway only.</p>
        <dl className="facts">
          <dt>Desired configuration</dt>
          <dd>Not stored as a cloud desired-state document</dd>
          <dt>Configuration transmitted</dt>
          <dd>Not implemented</dd>
          <dt>Gateway acknowledgement</dt>
          <dd>Not implemented</dd>
          <dt>Local configuration UI</dt>
          <dd>
            <Link to="/local/configure">Live Configure (Soft-AP / LAN proxy)</Link>
          </dd>
        </dl>
      </Panel>

      <section className="ops-section" aria-labelledby="gw-equipment-title">
        <h2 id="gw-equipment-title">Connected equipment</h2>
        {detail.generators.length === 0 ? (
          <p className="empty">No generator is linked to this device.</p>
        ) : (
          <DataTable
            caption="Generators linked to this gateway"
            rows={detail.generators}
            getRowKey={(row) => row._id}
            empty="No generator is linked to this device."
            columns={[
              {
                key: "name",
                header: "Generator",
                render: (row) => <Link to={`/generators/${row._id}`}>{row.name}</Link>,
              },
              {
                key: "open",
                header: "",
                render: (row) => <Link to={`/generators/${row._id}/trends`}>Trends</Link>,
              },
            ]}
          />
        )}
      </section>

      <FleetBoundary>
        <HealthEvents deviceId={deviceId} />
      </FleetBoundary>
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
  return (
    <section className="ops-section" aria-labelledby="gw-activity-title">
      <h2 id="gw-activity-title">Activity</h2>
      <p className="meta">Health transitions for this gateway (heartbeat, ingest, sweep).</p>
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
