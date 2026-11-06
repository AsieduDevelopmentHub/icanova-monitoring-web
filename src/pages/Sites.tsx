import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProvisionSiteDialog } from "../admin/ProvisionSiteDialog";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { FleetMap } from "../sites/FleetMap";
import { SiteRosterGrid } from "../sites/SiteRosterGrid";
import type { SiteRosterRow } from "../sites/siteRosterView";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { Skeleton } from "../ui/Skeleton";

/** Type A fleet list — sites with provision workflow and map view. */
export function Sites() {
  return (
    <section className="page ops-page sites-page">
      {/* Title lives in the shell topbar — avoid a second page header. */}
      <LiveGate
        emptyLayout="list"
        emptyCaption="Sites"
        emptyColumns={[
          "Site ID",
          "Site Name",
          "Last Updated",
          "Power Source",
          "Battery",
          "Fuel %",
          "HRM (h)",
          "Gateway ID",
          "Region",
          "Gens",
        ]}
      >
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
  const [view, setView] = useState<"list" | "map">("list");
  const canManage = permissions.includes("manage.sites") && permissions.includes("manage.devices");

  if (roster === undefined) {
    return <Skeleton lines={8} />;
  }

  const rows = roster as SiteRosterRow[];
  const regions = [...new Set(rows.map((row) => row.region).filter(Boolean))] as string[];
  const filtered = rows.filter((row) => {
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
    <div className="stack sites-stack">
      <div className="sites-controls">
        {canManage ? (
          <div className="sites-controls-primary">
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
        <div className="sites-toolbar">
          <p className="meta sites-toolbar-meta">
            {rows.length} sites
            {filtered.length !== rows.length ? ` · ${filtered.length} shown` : ""}
            {rows.filter((row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0).length > 0
              ? ` · ${rows.filter((row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0).length} attention`
              : ""}
          </p>
          <div className="sites-view-toggle" role="group" aria-label="Sites view">
            <button
              type="button"
              className={view === "list" ? "is-active" : undefined}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={view === "map" ? "is-active" : undefined}
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              Map
            </button>
          </div>
        </div>
      </div>
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
          searchable={false}
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
        <EmptyState
          title="No sites"
          body={rows.length === 0 ? "Provision a site and its gateway together." : "No rows match these filters."}
        />
      ) : view === "map" ? (
        <FleetMap sites={filtered} />
      ) : (
        <SiteRosterGrid rows={filtered} caption="Sites" mobileCards />
      )}
    </div>
  );
}
