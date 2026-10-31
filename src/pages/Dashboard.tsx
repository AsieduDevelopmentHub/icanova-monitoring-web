import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { storedReading } from "../fleet/access";
import { SiteAlarmPanel } from "../fleet/AlarmPanel";
import { DEMO_GENERATOR_ID } from "../telemetry/logModel";
import { engineView, linkView, snapshotScope, type LiveRow } from "../telemetry/fleetView";
import { pageFreshness, storedFreshness } from "../telemetry/freshness";
import { formatReading } from "../telemetry/readings";
import {
  contactAgeLabel,
  freshnessView,
  gatewayView,
  modbusView,
  overallView,
} from "../telemetry/deviceHealthView";
import { DataTable, type Column } from "../ui/DataTable";
import { FilterBar, FilterSearch } from "../ui/FilterBar";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";

type BoardRow = LiveRow & {
  generatorId: string;
  name: string;
  powerKw: number | null;
  powerQuality: string;
};

function formatContact(at: number | null | undefined): string {
  if (at == null || !Number.isFinite(at)) {
    return "Never";
  }
  return new Date(at).toISOString();
}

export function Dashboard() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p>
          Operational overview for one site: gateway contact, Modbus health, telemetry freshness, and
          active alarms. This board does not invent live values.
        </p>
      </header>
      <LiveGate>
        {(org) => (
          <SiteSelect organizationId={org.organizationId}>
            {(siteId, siteName, moreSites) => (
              <FleetBoundary key={siteId}>
                <SiteBoard
                  organizationId={org.organizationId}
                  siteId={siteId}
                  siteName={siteName}
                  moreSites={moreSites}
                  permissions={org.permissions}
                />
              </FleetBoundary>
            )}
          </SiteSelect>
        )}
      </LiveGate>
      <p className="meta">
        Demo log stays at{" "}
        <Link to={`/generators/${DEMO_GENERATOR_ID}`}>generators/{DEMO_GENERATOR_ID}</Link>. It is not
        this board.
      </p>
    </section>
  );
}

function SiteBoard({
  organizationId,
  siteId,
  siteName,
  moreSites,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
  moreSites: boolean;
  permissions: readonly string[];
}) {
  const data = useQuery(api.telemetry.currentForSite, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  const summary = useQuery(api.telemetry.siteSummary, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const loaded = (Array.isArray(data?.rows) ? data.rows : []) as BoardRow[];
    const q = query.trim().toLowerCase();
    if (!q) {
      return loaded;
    }
    return loaded.filter((row) => row.name.toLowerCase().includes(q));
  }, [data, query]);

  if (data === undefined || summary === undefined) {
    return <p className="empty">Loading operational overview.</p>;
  }

  const loaded = (Array.isArray(data.rows) ? data.rows : []) as BoardRow[];
  const scope = snapshotScope(loaded, Boolean(data.capped));
  const freshness = pageFreshness(loaded, Date.now());
  const siteReady = summary.ready === true;
  const lastUpdate = summary.lastTelemetryAt ?? summary.lastGatewayContactAt ?? null;
  const columns: Column<BoardRow>[] = [
    {
      key: "name",
      header: "Generator",
      render: (row) => <Link to={`/generators/${row.generatorId}`}>{row.name}</Link>,
    },
    {
      key: "link",
      header: "Modbus",
      render: (row) => {
        const link = linkView(row.link);
        return <StatusMark tone={link.tone}>{link.label}</StatusMark>;
      },
    },
    {
      key: "engine",
      header: "Engine",
      render: (row) => {
        const engine = engineView(row.rpm, row.rpmQuality);
        return <StatusMark tone={engine.tone}>{engine.label}</StatusMark>;
      },
    },
    {
      key: "freshness",
      header: "Freshness",
      render: (row) => {
        const state = storedFreshness(row.updatedAt, Date.now());
        return (
          <StatusMark tone={state.stale ? "warn" : state.state === "fresh" ? "ok" : "offline"}>
            {state.state === "fresh" ? "Fresh" : state.state === "stale" ? "Stale" : "Missing"}
          </StatusMark>
        );
      },
    },
    {
      key: "alarms",
      header: "Alarm count",
      align: "right",
      render: (row) =>
        row.alarmCount === null || !Number.isFinite(row.alarmCount) ? (
          "—"
        ) : row.alarmCount > 0 ? (
          <StatusMark tone="warn">{String(row.alarmCount)}</StatusMark>
        ) : (
          "0"
        ),
    },
    {
      key: "rpm",
      header: "RPM",
      align: "right",
      render: (row) => formatReading(storedReading(row.rpm, row.rpmQuality, "rpm")),
    },
    {
      key: "power",
      header: "kW",
      align: "right",
      render: (row) => formatReading(storedReading(row.powerKw, row.powerQuality, "kW")),
    },
    {
      key: "stored",
      header: "Stored",
      render: (row) => {
        const state = storedFreshness(row.updatedAt, Date.now());
        return (
          <>
            {state.stale ? <StatusMark tone="warn">Stale</StatusMark> : null} {state.label}
          </>
        );
      },
    },
  ];

  return (
    <div className="stack">
      <div className="ops-banner">
        <div>
          <p className="meta">
            Site <strong>{siteName}</strong>
            {moreSites ? " · use the site selector above for other sites" : ""}
          </p>
          <p className="meta">
            Last stored contact{" "}
            <span className="tech">{formatContact(lastUpdate)}</span>
            {lastUpdate != null ? ` (${contactAgeLabel(lastUpdate, Date.now())})` : ""}. Gateway Online
            is cloud contact within 3 min — not Modbus.
          </p>
        </div>
        <div className="ops-links">
          <Link to="/gateways">Gateways</Link>
          <Link to="/local">Live readings</Link>
          <Link to="/alarms">Alarms</Link>
          <Link to="/events">Events</Link>
          <Link to="/reports">Reports</Link>
        </div>
      </div>

      {loaded.length === 0 ? (
        <p className="empty">
          No generators are registered on this site. Register a device and a generator on Generators.
          The device identity is the 12-character efuse MAC.
        </p>
      ) : scope.reporting === 0 ? (
        <div className="notice" role="note">
          <strong>No live telemetry.</strong> Generators are registered, and none has a stored reading.
          Check that the gateway identity matches the registered device.
        </div>
      ) : null}

      <section className="ops-section" aria-labelledby="ops-summary-title">
        <h2 id="ops-summary-title">Operational summary</h2>
        <p className="meta">
          {siteReady
            ? "Stored site tallies. Freshness ages without a new sample."
            : scope.note}
        </p>
        <div className="metric-grid">
          <Metric
            label="Gateways online"
            value={siteReady ? String(summary.gatewayOnline ?? 0) : "—"}
            note="Heartbeat or accepted ingest ≤ 3 min"
          />
          <Metric
            label="Gateways offline"
            value={siteReady ? String(summary.gatewayOffline ?? 0) : "—"}
            note="No gateway contact within 3 min"
          />
          <Metric
            label="Devices tracked"
            value={siteReady ? String(summary.devicesTracked ?? 0) : "—"}
            note="Health rows for this site"
          />
          <Metric
            label="Generators"
            value={
              siteReady && summary.generators !== null
                ? String(summary.generators)
                : String(scope.generators)
            }
            note={siteReady ? "Registered on this site" : scope.note}
          />
          <Metric
            label="Reporting"
            value={siteReady ? String(summary.reporting) : String(scope.reporting)}
            note="Generators with a stored reading"
          />
          <Metric
            label="Modbus fail"
            value={siteReady ? String(summary.linkFail) : String(scope.modbusFail)}
            note="Sample link fail — not engine stop"
          />
          <Metric
            label="Comm problems"
            value={siteReady ? String(summary.activeCommProblems ?? 0) : "—"}
            note="Active communication problems"
          />
          <Metric
            label="Fresh telemetry"
            value={siteReady ? String(summary.telemetryFresh ?? freshness.fresh) : String(freshness.fresh)}
            note="Age of stored reading"
          />
          <Metric
            label="Stale telemetry"
            value={siteReady ? String(summary.telemetryStale ?? freshness.stale) : String(freshness.stale)}
            note="Not the same as Modbus fail"
          />
          <Metric
            label="Overall unhealthy"
            value={siteReady ? String(summary.overallUnhealthy ?? 0) : "—"}
            note="Worst of gateway, Modbus, freshness"
          />
        </div>
      </section>

      <FleetBoundary>
        <GatewayHealthSection organizationId={organizationId} siteId={siteId} />
      </FleetBoundary>

      <SiteAlarmPanel
        organizationId={organizationId}
        siteId={siteId}
        permissions={permissions}
      />

      <FleetBoundary>
        <RecentActivitySection organizationId={organizationId} siteId={siteId} />
      </FleetBoundary>

      <section className="ops-section" aria-labelledby="ops-readings-title">
        <h2 id="ops-readings-title">Current generator readings</h2>
        <p className="meta">{scope.note}</p>
        <FilterBar label="Filter this site snapshot">
          <FilterSearch label="Name" value={query} onChange={setQuery} placeholder="Generator name" />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.generatorId}
          empty={
            loaded.length === 0
              ? "No generators are registered on this site."
              : "No name matches this filter."
          }
          caption={`Current readings for ${siteName}`}
        />
      </section>
    </div>
  );
}

function GatewayHealthSection({
  organizationId,
  siteId,
}: {
  organizationId: string;
  siteId: Id<"sites">;
}) {
  const data = useQuery(api.devices.siteHealth, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  if (data === undefined) {
    return <p className="empty">Loading gateway health.</p>;
  }
  const now = Date.now();
  return (
    <section className="ops-section" aria-labelledby="ops-gateway-title">
      <h2 id="ops-gateway-title">Gateway health</h2>
      <p className="meta">
        iCanOva Edge devices on this site. Online/offline is cloud contact. Firmware version is not
        stored yet.
        {data.capped ? " First page only — not a complete inventory." : ""}
      </p>
      <DataTable
        caption="Gateways on this site"
        rows={data.rows}
        getRowKey={(row) => row._id}
        empty="No gateways are registered on this site."
        columns={[
          {
            key: "name",
            header: "Gateway",
            render: (row) => <Link to={`/gateways/${row._id}`}>{row.name}</Link>,
          },
          {
            key: "identity",
            header: "Identity",
            render: (row) => <span className="tech">{row.identity}</span>,
          },
          {
            key: "gateway",
            header: "Cloud",
            render: (row) => {
              const view = gatewayView(row.gatewayStatus);
              return <StatusMark tone={view.tone}>{view.label}</StatusMark>;
            },
          },
          {
            key: "modbus",
            header: "Modbus",
            render: (row) => {
              const view = modbusView(row.modbusStatus);
              return <StatusMark tone={view.tone}>{view.label}</StatusMark>;
            },
          },
          {
            key: "fresh",
            header: "Telemetry",
            render: (row) => {
              const view = freshnessView(row.telemetryFreshness);
              return <StatusMark tone={view.tone}>{view.label}</StatusMark>;
            },
          },
          {
            key: "overall",
            header: "Overall",
            render: (row) => {
              const view = overallView(row.overallStatus);
              return <StatusMark tone={view.tone}>{view.label}</StatusMark>;
            },
          },
          {
            key: "seen",
            header: "Last seen",
            render: (row) => contactAgeLabel(row.lastGatewayContactAt, now),
          },
          {
            key: "gens",
            header: "Generators",
            align: "right",
            render: (row) => String(row.generatorCount),
          },
        ]}
      />
      <p className="meta">
        <Link to="/gateways">Open full gateway inventory</Link>
      </p>
    </section>
  );
}

function RecentActivitySection({
  organizationId,
  siteId,
}: {
  organizationId: string;
  siteId: Id<"sites">;
}) {
  const data = useQuery(api.deviceHealth.recentForSite, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  if (data === undefined) {
    return <p className="empty">Loading recent activity.</p>;
  }
  return (
    <section className="ops-section" aria-labelledby="ops-activity-title">
      <h2 id="ops-activity-title">Recent activity</h2>
      <p className="meta">
        Stored health transitions for this site (heartbeat, ingest, sweep). Not a fabricated event
        feed.
        {data.capped ? " Newest page only." : ""}
      </p>
      <DataTable
        caption="Recent health transitions"
        rows={data.rows}
        getRowKey={(row) => row._id}
        empty="No health transitions are stored for this site yet."
        columns={[
          {
            key: "at",
            header: "When",
            render: (row) => <span className="tech">{new Date(row.at).toISOString()}</span>,
          },
          {
            key: "device",
            header: "Gateway",
            render: (row) => <Link to={`/gateways/${row.deviceId}`}>{row.deviceName}</Link>,
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
    </section>
  );
}
