import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id, storedReading } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { engineView, linkView } from "../telemetry/fleetView";
import { storedFreshness } from "../telemetry/freshness";
import { formatReading } from "../telemetry/readings";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";
import { Skeleton } from "../ui/Skeleton";
import type { BoardRow } from "./dashboard/types";

/** Type A — fleet generator list that drills into site-scoped detail. */
export function Generators() {
  return (
    <section className="page ops-page">
      <header className="page-head">
        <h1>Generators</h1>
      </header>
      <LiveGate
        emptyLayout="list"
        emptyCaption="Generators"
        emptyColumns={["Generator", "Site", "State", "Power", "Status"]}
      >
        {(org) => <GeneratorList organizationId={org.organizationId} permissions={org.permissions} />}
      </LiveGate>
    </section>
  );
}

function GeneratorList({
  organizationId,
  permissions,
}: {
  organizationId: string;
  permissions: readonly string[];
}) {
  const data = useQuery(
    api.telemetry.currentForOrg,
    permissions.includes("view.telemetry")
      ? { organizationId: id<"organizations">(organizationId) }
      : "skip",
  );
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");

  const rows = useMemo(() => (Array.isArray(data?.rows) ? (data.rows as BoardRow[]) : []), [data]);

  if (!permissions.includes("view.telemetry")) {
    return <EmptyState title="Telemetry required" body="view.telemetry is needed for this list." />;
  }
  if (data === undefined) {
    return <Skeleton lines={8} />;
  }

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = `${row.name} ${row.siteName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    const engine = engineView(row.rpm, row.rpmQuality);
    if (state === "running" && engine.label !== "Running") {
      return false;
    }
    if (state === "stopped" && engine.label === "Running") {
      return false;
    }
    if (state === "attention") {
      const fresh = storedFreshness(row.updatedAt, Date.now());
      const link = linkView(row.link);
      return fresh.stale || link.tone === "alarm" || (row.alarmCount ?? 0) > 0;
    }
    return true;
  });

  return (
    <div className="stack">
      <p className="meta">
        {rows.length} generators
        {data.capped ? " · capped" : ""}
        {filtered.length !== rows.length ? ` · ${filtered.length} shown` : ""}
      </p>
      <FilterBar label="Generator filters">
        <FilterSearch label="Search" value={query} onChange={setQuery} placeholder="Name or site" />
        <FilterSelect
          label="State"
          value={state}
          onChange={setState}
          options={[
            { value: "all", label: "All states" },
            { value: "running", label: "Running" },
            { value: "stopped", label: "Stopped" },
            { value: "attention", label: "Attention" },
          ]}
        />
      </FilterBar>
      {filtered.length === 0 ? (
        <EmptyState
          title="No generators"
          body={rows.length === 0 ? "Register equipment on a site." : "No rows match these filters."}
          action={<Link to="/sites">Sites</Link>}
        />
      ) : (
        <DataTable
          dense
          caption="Generators"
          rows={filtered}
          getRowKey={(row) => row.generatorId}
          empty="No generators"
          columns={[
            {
              key: "name",
              header: "Generator",
              render: (row) => <Link to={`/generators/${row.generatorId}`}>{row.name}</Link>,
            },
            {
              key: "site",
              header: "Site",
              render: (row) =>
                row.siteId ? <Link to={`/sites/${row.siteId}`}>{row.siteName ?? "Site"}</Link> : "—",
            },
            {
              key: "state",
              header: "State",
              render: (row) => {
                const engine = engineView(row.rpm, row.rpmQuality);
                return <StatusMark tone={engine.tone}>{engine.label}</StatusMark>;
              },
            },
            {
              key: "power",
              header: "Power",
              align: "right",
              render: (row) => formatReading(storedReading(row.powerKw, row.powerQuality, "kW")),
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
              key: "fresh",
              header: "Freshness",
              render: (row) => {
                const fresh = storedFreshness(row.updatedAt, Date.now());
                return (
                  <StatusMark tone={fresh.stale ? "warn" : fresh.state === "fresh" ? "ok" : "offline"}>
                    {fresh.state === "fresh" ? "Fresh" : fresh.state === "stale" ? "Stale" : "Missing"}
                  </StatusMark>
                );
              },
            },
            {
              key: "alarms",
              header: "Alarms",
              align: "right",
              render: (row) =>
                (row.alarmCount ?? 0) > 0 ? (
                  <StatusMark tone="warn">{String(row.alarmCount)}</StatusMark>
                ) : (
                  "0"
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
