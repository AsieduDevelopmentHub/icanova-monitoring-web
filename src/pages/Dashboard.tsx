import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { storedReading } from "../fleet/access";
import { SiteAlarmPanel } from "../fleet/AlarmPanel";
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
import { Panel } from "../ui/Panel";
import { SectionHeader } from "../ui/SectionHeader";
import { SeriesChart } from "../ui/SeriesChart";
import { Skeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";
import { StatusStrip } from "../ui/StatusStrip";
import { CommandTwinLazy } from "../viz/CommandTwinLazy";
import type { TwinStatus } from "../viz/CommandTwin";
import { id } from "../fleet/access";

type BoardRow = LiveRow & {
  generatorId: string;
  name: string;
  powerKw: number | null;
  powerQuality: string;
};

export function Dashboard() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Command Center</h1>
      </header>
      <LiveGate>
        {(org) => (
          <SiteSelect organizationId={org.organizationId}>
            {(siteId, siteName) => (
              <FleetBoundary key={siteId}>
                <SiteBoard
                  organizationId={org.organizationId}
                  siteId={siteId}
                  siteName={siteName}
                  permissions={org.permissions}
                />
              </FleetBoundary>
            )}
          </SiteSelect>
        )}
      </LiveGate>
    </section>
  );
}

function twinFromRows(rows: BoardRow[]): TwinStatus {
  if (rows.length === 0) {
    return "unknown";
  }
  const engines = rows.map((row) => engineView(row.rpm, row.rpmQuality));
  if (engines.some((e) => e.tone === "alarm")) {
    return "fault";
  }
  if (engines.some((e) => e.label.toLowerCase().includes("run"))) {
    return "running";
  }
  const links = rows.map((row) => linkView(row.link));
  if (links.some((l) => l.tone === "alarm" || l.tone === "warn")) {
    return "warning";
  }
  const fresh = rows.map((row) => storedFreshness(row.updatedAt, Date.now()));
  if (fresh.every((f) => f.state !== "fresh" && !f.stale)) {
    return "offline";
  }
  if (fresh.some((f) => f.stale)) {
    return "warning";
  }
  return "stopped";
}

function SiteBoard({
  organizationId,
  siteId,
  siteName,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
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

  const unhealthy = siteReady ? (summary.overallUnhealthy ?? 0) : 0;
  const offlineGateways = siteReady ? (summary.gatewayOffline ?? 0) : 0;
  const systemTone =
    unhealthy > 0 || (summary.linkFail ?? 0) > 0
      ? "alarm"
      : offlineGateways > 0 || freshness.stale > 0
        ? "warn"
        : siteReady
          ? "ok"
          : "offline";
  const systemLabel =
    systemTone === "alarm"
      ? "Attention required"
      : systemTone === "warn"
        ? "Degraded"
        : siteReady
          ? "Operational"
          : "Unavailable";
  const primary = loaded[0];
  const twinStatus = twinFromRows(loaded);

  return (
    <div className="cc-layout">
      <StatusStrip
        title={siteName}
        subtitle={systemLabel}
        items={[
          {
            label: "Online",
            value: siteReady ? String(summary.gatewayOnline ?? 0) : "—",
            tone: siteReady ? "ok" : "offline",
          },
          {
            label: "Generators",
            value:
              siteReady && summary.generators !== null
                ? String(summary.generators)
                : String(scope.generators),
          },
          {
            label: "Modbus fail",
            value: siteReady ? String(summary.linkFail) : String(scope.modbusFail),
            tone: (summary.linkFail ?? scope.modbusFail) > 0 ? "alarm" : "ok",
          },
          {
            label: "Stale",
            value: String(siteReady ? (summary.telemetryStale ?? freshness.stale) : freshness.stale),
            tone: (summary.telemetryStale ?? freshness.stale) > 0 ? "warn" : "ok",
          },
        ]}
        trailing={
          <div className="ops-links">
            <Link to="/alarms">Alarms</Link>
            <Link to="/gateways">Gateways</Link>
          </div>
        }
      />

      {loaded.length === 0 ? (
        <EmptyState
          title="No generators"
          body="Register a gateway and generator for this site."
          action={<Link to="/generators">Generators</Link>}
        />
      ) : scope.reporting === 0 ? (
        <div className="notice" role="note">
          <strong>No telemetry yet.</strong>
        </div>
      ) : null}

      <div className="cc-viz-grid">
        <div>
          <CommandTwinLazy status={twinStatus} label={primary?.name ?? siteName} />
          {loaded.length > 0 ? (
            <ul className="cc-equip-list" style={{ marginTop: "0.75rem" }}>
              {loaded.slice(0, 8).map((row) => {
                const engine = engineView(row.rpm, row.rpmQuality);
                const fresh = storedFreshness(row.updatedAt, Date.now());
                return (
                  <li key={row.generatorId}>
                    <Link to={`/generators/${row.generatorId}`}>{row.name}</Link>
                    <StatusMark
                      tone={
                        engine.tone === "alarm"
                          ? "alarm"
                          : fresh.stale
                            ? "warn"
                            : engine.tone === "ok"
                              ? "ok"
                              : "offline"
                      }
                    >
                      {engine.label}
                    </StatusMark>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <FleetBoundary>
          <OperationalAttention
            organizationId={organizationId}
            siteId={siteId}
            permissions={permissions}
          />
        </FleetBoundary>
      </div>

      {primary && permissions.includes("view.telemetry") ? (
        <div>
          <SectionHeader
            title={primary.name}
            actions={<Link to={`/generators/${primary.generatorId}/trends`}>Trends</Link>}
          />
          <CommandCharts generatorId={primary.generatorId} />
        </div>
      ) : null}

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
        title="Readings"
        actions={
          <FilterBar label="Filter">
            <FilterSearch label="Name" value={query} onChange={setQuery} placeholder="Name" />
          </FilterBar>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.generatorId}
          empty={loaded.length === 0 ? "No generators." : "No matches."}
          caption={siteName}
        />
      </Panel>
    </div>
  );
}

function CommandCharts({ generatorId }: { generatorId: string }) {
  const series = useQuery(api.telemetry.series, {
    generatorId: id<"generators">(generatorId),
    range: "day",
  });
  if (series === undefined) {
    return <Skeleton lines={4} />;
  }
  return (
    <div className="cc-charts">
      <SeriesChart
        title="Power"
        unit="kW"
        points={series.power}
        reduced={series.reduced.power}
        caption="24h"
        height={240}
      />
      <SeriesChart
        title="Frequency"
        unit="Hz"
        points={series.frequency}
        reduced={series.reduced.frequency}
        caption="24h"
        height={240}
      />
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
    <Panel title="Attention" tone={tone}>
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
    <Panel title="Gateways" actions={<Link to="/gateways">All</Link>}>
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
    <Panel title="Events">
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
