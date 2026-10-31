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
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSearch } from "../ui/FilterBar";
import { Metric } from "../ui/Metric";
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";
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
        <h1>Operations overview</h1>
        <p>
          Attention first. Then cloud contact, Modbus health, measurement freshness and readings —
          from stored telemetry only.
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
    return <Skeleton lines={6} className="panel" />;
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
    <div className="dash-layout">
      <div className="ops-banner">
        <div>
          <p className="meta">
            Site <strong>{siteName}</strong>
            {moreSites ? " · switch sites above" : ""}
          </p>
          <p className="meta">
            Last stored contact{" "}
            <span className="tech">{formatContact(lastUpdate)}</span>
            {lastUpdate != null ? ` (${contactAgeLabel(lastUpdate, Date.now())})` : ""}. Cloud
            contact ≠ Modbus ≠ freshness.
          </p>
        </div>
        <div className="ops-links">
          <Link to="/alarms">Alarms</Link>
          <Link to="/gateways">Gateways</Link>
          <Link to="/local">Live readings</Link>
          <Link to="/events">Events</Link>
        </div>
      </div>

      {loaded.length === 0 ? (
        <EmptyState
          title="No generators on this site"
          body="Register a gateway and generator to populate this board. Device identity is the 12-character eFuse MAC."
          action={<Link to="/generators">Open generators</Link>}
        />
      ) : scope.reporting === 0 ? (
        <div className="notice" role="note">
          <strong>No stored telemetry yet.</strong> Generators are registered, but none has a reading.
          Confirm the gateway identity matches the registered device.
        </div>
      ) : null}

      <div className="dash-hero">
        <FleetBoundary>
          <OperationalAttention
            organizationId={organizationId}
            siteId={siteId}
            permissions={permissions}
          />
        </FleetBoundary>

        <Panel
          title="Site health at a glance"
          description={
            siteReady
              ? "Secondary tallies from stored health. Freshness ages without a new sample."
              : scope.note
          }
        >
          <div className="metric-grid metric-grid-primary metric-grid-secondary">
            <Metric
              label="Cloud online"
              value={siteReady ? String(summary.gatewayOnline ?? 0) : "—"}
              note="Contact ≤ 3 min"
              tone="ok"
            />
            <Metric
              label="Cloud offline"
              value={siteReady ? String(summary.gatewayOffline ?? 0) : "—"}
              note="No contact ≤ 3 min"
              tone={(summary.gatewayOffline ?? 0) > 0 ? "warn" : "ok"}
            />
            <Metric
              label="Modbus fail"
              value={siteReady ? String(summary.linkFail) : String(scope.modbusFail)}
              note="Sample link — not engine stop"
              tone={(summary.linkFail ?? scope.modbusFail) > 0 ? "alarm" : "ok"}
            />
            <Metric
              label="Stale readings"
              value={
                siteReady
                  ? String(summary.telemetryStale ?? freshness.stale)
                  : String(freshness.stale)
              }
              note="Age of stored reading"
              tone={(summary.telemetryStale ?? freshness.stale) > 0 ? "warn" : "ok"}
            />
            <Metric
              label="Generators"
              value={
                siteReady && summary.generators !== null
                  ? String(summary.generators)
                  : String(scope.generators)
              }
              note={`${siteReady ? summary.reporting : scope.reporting} reporting`}
            />
            <Metric
              label="Overall unhealthy"
              value={siteReady ? String(summary.overallUnhealthy ?? 0) : "—"}
              note="Worst of cloud, Modbus, freshness"
              tone={(summary.overallUnhealthy ?? 0) > 0 ? "alarm" : "ok"}
              emphasis={(summary.overallUnhealthy ?? 0) > 0}
            />
          </div>
        </Panel>
      </div>

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

      <Panel
        title="Current generator readings"
        description={scope.note}
        actions={
          <FilterBar label="Filter this site snapshot">
            <FilterSearch
              label="Name"
              value={query}
              onChange={setQuery}
              placeholder="Generator name"
            />
          </FilterBar>
        }
      >
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
      </Panel>
    </div>
  );
}

function OperationalAttention({
  organizationId,
  siteId,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  permissions: readonly string[];
}) {
  const canAlarms = permissions.includes("view.alarms");
  const canDash = permissions.includes("view.dashboard");
  const alarms = useQuery(
    api.alarms.forSite,
    canAlarms
      ? { organizationId: organizationId as Id<"organizations">, siteId }
      : "skip",
  );
  const health = useQuery(
    api.devices.siteHealth,
    canDash
      ? { organizationId: organizationId as Id<"organizations">, siteId }
      : "skip",
  );
  const unreadCritical = useQuery(
    api.notifications.unreadCriticalCount,
    canAlarms || canDash
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  if (alarms === undefined || health === undefined || unreadCritical === undefined) {
    return <Skeleton lines={5} />;
  }

  const alarmRows = Array.isArray(alarms?.rows) ? alarms.rows : [];
  const active = alarmRows.filter(
    (row: { state?: string }) => row.state === "active" || row.state === "acknowledged",
  );
  const critical = active.filter((row: { severity?: string }) => row.severity === "critical").length;
  const warning = active.filter((row: { severity?: string }) => row.severity === "warning").length;
  const gateways = Array.isArray(health?.rows) ? health.rows : [];
  const offline = gateways.filter(
    (row: { gatewayStatus?: string }) => row.gatewayStatus === "offline",
  ).length;
  const stale = gateways.filter(
    (row: { telemetryFreshness?: string }) => row.telemetryFreshness === "stale",
  ).length;

  const items = [
    {
      key: "critical",
      label: "Active critical alarms",
      value: critical,
      href: "/alarms",
      className: critical > 0 ? "is-critical" : "",
    },
    {
      key: "warning",
      label: "Active warning alarms",
      value: warning,
      href: "/alarms",
      className: warning > 0 ? "is-warning" : "",
    },
    {
      key: "offline",
      label: "Offline gateways",
      value: offline,
      href: "/gateways",
      className: offline > 0 ? "is-warning" : "",
    },
    {
      key: "stale",
      label: "Stale measurements",
      value: stale,
      href: "/gateways",
      className: stale > 0 ? "is-warning" : "",
    },
    {
      key: "inbox",
      label: "Unread critical notices",
      value: unreadCritical,
      href: "/notifications",
      className: unreadCritical > 0 ? "is-critical" : "",
    },
  ];

  const tone =
    critical > 0 || unreadCritical > 0 ? "critical" : warning > 0 || offline > 0 ? "warning" : "default";

  return (
    <Panel
      title="Needs attention"
      description="Priority signals for this site. Creation in the inbox is not proof of push/email delivery."
      tone={tone}
    >
      <ul className="attention-list">
        {items.map((item) => (
          <li key={item.key} className={`attention-item ${item.className}`.trim()}>
            <div>
              <div className="meta">{item.label}</div>
              <div className="attention-value">{item.value}</div>
            </div>
            <Link to={item.href}>Inspect</Link>
          </li>
        ))}
      </ul>
    </Panel>
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
    return <Skeleton lines={4} />;
  }
  const now = Date.now();
  return (
    <Panel
      title="Gateway health"
      description={`Cloud contact, Modbus, and freshness stay separate. Firmware version is not stored yet.${
        data.capped ? " First page only." : ""
      }`}
      actions={<Link to="/gateways">Full inventory</Link>}
    >
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
    </Panel>
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
    return <Skeleton lines={4} />;
  }
  return (
    <Panel
      title="Recent activity"
      description={`Stored health transitions (heartbeat, ingest, sweep). Not a fabricated feed.${
        data.capped ? " Newest page only." : ""
      }`}
    >
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
    </Panel>
  );
}
