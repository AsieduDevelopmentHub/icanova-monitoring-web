import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProvisionSiteDialog } from "../admin/ProvisionSiteDialog";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";
import { Skeleton } from "../ui/Skeleton";

function ageLabel(at: number | null): string {
  if (at == null) {
    return "—";
  }
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.round(hours / 24)}d`;
}

/** Type A fleet list — sites with provision workflow. */
export function Sites() {
  return (
    <section className="page ops-page">
      <header className="page-head">
        <h1>Sites</h1>
      </header>
      <LiveGate emptyLayout="list" emptyCaption="Sites" emptyColumns={["Code", "Site", "Region", "Status"]}>
        {(org) => (
          <SiteList
            organizationId={org.organizationId}
            permissions={org.permissions}
            siteCodeFormat={
              "siteCodeFormat" in org && (org.siteCodeFormat === "numeric" || org.siteCodeFormat === "text")
                ? org.siteCodeFormat
                : "text"
            }
          />
        )}
      </LiveGate>
    </section>
  );
}

function SiteList({
  organizationId,
  permissions,
  siteCodeFormat,
}: {
  organizationId: string;
  permissions: readonly string[];
  siteCodeFormat: "numeric" | "text";
}) {
  const roster = useQuery(api.telemetry.siteRoster, {
    organizationId: id<"organizations">(organizationId),
  });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [state, setState] = useState("all");
  const canManage = permissions.includes("manage.sites") && permissions.includes("manage.devices");

  if (roster === undefined) {
    return <Skeleton lines={8} />;
  }

  const regions = [...new Set(roster.map((row) => row.region).filter(Boolean))] as string[];
  const filtered = roster.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = `${row.name} ${row.code ?? ""} ${row.region ?? ""}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    if (region !== "all" && row.region !== region) {
      return false;
    }
    if (state === "attention") {
      return row.overallUnhealthy > 0 || row.gatewayOffline > 0 || row.linkFail > 0 || row.activeCommProblems > 0;
    }
    if (state === "operational") {
      return row.reporting > 0 || row.gatewayOnline > 0;
    }
    return true;
  });

  return (
    <div className="stack">
      {canManage ? (
        <div className="ops-toolbar">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Provision site
          </button>
          <ProvisionSiteDialog
            open={open}
            organizationId={id<"organizations">(organizationId)}
            siteCodeFormat={siteCodeFormat}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
      <p className="meta">
        {roster.length} sites
        {filtered.length !== roster.length ? ` · ${filtered.length} shown` : ""}
        {roster.filter((row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0).length > 0
          ? ` · ${roster.filter((row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0).length} attention`
          : ""}
      </p>
      <FilterBar label="Site filters">
        <FilterSearch label="Search" value={query} onChange={setQuery} placeholder="Site, code, region" />
        <FilterSelect
          label="Region"
          value={region}
          onChange={setRegion}
          options={[
            { value: "all", label: "All regions" },
            ...regions.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          label="State"
          value={state}
          onChange={setState}
          options={[
            { value: "all", label: "All states" },
            { value: "attention", label: "Attention" },
            { value: "operational", label: "Operational" },
          ]}
        />
      </FilterBar>
      {filtered.length === 0 ? (
        <EmptyState title="No sites" body={roster.length === 0 ? "Provision a site and its gateway together." : "No rows match these filters."} />
      ) : (
        <DataTable
          dense
          caption="Sites"
          rows={filtered}
          getRowKey={(row) => row.siteId}
          empty="No sites"
          columns={[
            {
              key: "code",
              header: "Code",
              render: (row) => <span className="tech">{row.code ?? "—"}</span>,
            },
            {
              key: "name",
              header: "Site",
              render: (row) => <Link to={`/sites/${row.siteId}`}>{row.name}</Link>,
            },
            { key: "region", header: "Region", render: (row) => row.region ?? "—" },
            {
              key: "gw",
              header: "Gateway",
              render: (row) =>
                row.gatewayOffline > 0 ? (
                  <StatusMark tone="warn">Offline</StatusMark>
                ) : row.gatewayOnline > 0 ? (
                  <StatusMark tone="ok">Online</StatusMark>
                ) : (
                  <StatusMark tone="offline">—</StatusMark>
                ),
            },
            {
              key: "gens",
              header: "Generators",
              align: "right",
              render: (row) => String(row.generators ?? "—"),
            },
            {
              key: "alarms",
              header: "Alarms",
              align: "right",
              render: (row) =>
                row.activeCommProblems > 0 ? (
                  <StatusMark tone="warn">{String(row.activeCommProblems)}</StatusMark>
                ) : (
                  "0"
                ),
            },
            {
              key: "seen",
              header: "Last contact",
              render: (row) => (
                <span className="tech">{ageLabel(row.lastGatewayContactAt ?? row.lastTelemetryAt)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) =>
                row.overallUnhealthy > 0 || row.linkFail > 0 ? (
                  <StatusMark tone="alarm">Attention</StatusMark>
                ) : row.gatewayOffline > 0 ? (
                  <StatusMark tone="warn">Degraded</StatusMark>
                ) : row.reporting > 0 || row.gatewayOnline > 0 ? (
                  <StatusMark tone="ok">Operational</StatusMark>
                ) : (
                  <StatusMark tone="offline">Idle</StatusMark>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
