import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { engineView, linkView, registrationLabel, snapshotScope } from "../telemetry/fleetView";
import { storedFreshness } from "../telemetry/freshness";
import { DataTable } from "../ui/DataTable";
import { StatusMark } from "../ui/StatusMark";
import { SiteAlarmPanel } from "../fleet/AlarmPanel";

type SiteRow = { _id: string; name: string };

export function Sites() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Sites</h1>
        <p>Sites in the signed-in organization. A site record stores a name. It has no location field.</p>
      </header>
      <LiveGate>
        {(org) => <SiteList organizationId={org.organizationId} permissions={org.permissions} />}
      </LiveGate>
    </section>
  );
}

function SiteList({
  organizationId,
  permissions,
}: {
  organizationId: string;
  permissions: readonly string[];
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const sites = useQuery(api.sites.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor },
  });
  if (sites === undefined) {
    return <p className="empty">Loading sites.</p>;
  }
  const page = (Array.isArray(sites.page) ? sites.page : []) as SiteRow[];
  const selected = page.find((site) => site._id === picked) ?? page[0];
  return (
    <div className="stack">
      {page.length === 0 ? (
        <p className="empty">
          No sites are registered in this organization. Create one on Generators before a gateway can
          be attached.
        </p>
      ) : (
        <DataTable
          caption="Sites in this organization"
          rows={page}
          getRowKey={(row) => row._id}
          empty="No sites on this page."
          columns={[
            { key: "name", header: "Name", render: (row) => row.name },
            {
              key: "open",
              header: "",
              render: (row) => (
                <button type="button" className="text-btn" onClick={() => setPicked(row._id)}>
                  {selected?._id === row._id ? "Selected" : "Select"}
                </button>
              ),
            },
          ]}
        />
      )}
      {sites.isDone === false && sites.continueCursor ? (
        <p className="meta">
          This is not every site.{" "}
          <button type="button" className="text-btn" onClick={() => setCursor(sites.continueCursor)}>
            Next sites
          </button>
        </p>
      ) : null}
      {selected ? (
        <FleetBoundary key={selected._id}>
          <SiteDetail
            organizationId={organizationId}
            siteId={id<"sites">(selected._id)}
            siteName={selected.name}
            permissions={permissions}
          />
        </FleetBoundary>
      ) : null}
    </div>
  );
}

function SiteDetail({
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
  const [cursor, setCursor] = useState<string | null>(null);
  const generators = useQuery(api.generators.list, {
    organizationId: id<"organizations">(organizationId),
    siteId,
    paginationOpts: { numItems: 50, cursor },
  });
  const current = useQuery(api.telemetry.currentForSite, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
  const summary = useQuery(api.telemetry.siteSummary, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
  if (generators === undefined || current === undefined || summary === undefined) {
    return <p className="empty">Loading {siteName}.</p>;
  }
  const registered = Array.isArray(generators.page) ? generators.page : [];
  const readings = Array.isArray(current.rows) ? current.rows : [];
  const scope = snapshotScope(readings, Boolean(current.capped));
  return (
    <div className="stack">
      <h2>{siteName}</h2>
      <p className="meta">{registrationLabel(registered.length, generators.isDone !== false)}</p>
      <p className="meta">
        {summary?.ready
          ? `Site summary: ${summary.generators === null ? "generators not fully counted" : `${summary.generators} generators`}, ${summary.reporting} reporting, gateways ${summary.gatewayOnline ?? 0} online / ${summary.gatewayOffline ?? 0} offline, Modbus ${summary.linkOk} ok / ${summary.linkFail} fail / ${summary.linkDegraded} degraded, telemetry fresh ${summary.telemetryFresh ?? 0} / stale ${summary.telemetryStale ?? 0}. Modbus fail is not an engine stop.`
          : "Site summary is stored when a generator is registered or a sample arrives."}{" "}
        This page of Modbus links: {scope.modbusOk} ok, {scope.modbusFail} fail, {scope.modbusDegraded}{" "}
        degraded, {scope.unknown} unknown. {scope.note}
      </p>
      <DataTable
        caption={`Registered generators at ${siteName}`}
        rows={registered}
        getRowKey={(row) => row._id}
        empty="No generators are registered on this site."
        columns={[
          {
            key: "name",
            header: "Generator",
            render: (row) => <Link to={`/generators/${row._id}`}>{row.name}</Link>,
          },
        ]}
      />
      {generators.isDone === false && generators.continueCursor ? (
        <button type="button" className="text-btn" onClick={() => setCursor(generators.continueCursor)}>
          Next generators
        </button>
      ) : null}
      <DataTable
        caption={`Current links at ${siteName}`}
        rows={readings}
        getRowKey={(row) => row.generatorId}
        empty="No generators are in the current snapshot."
        columns={[
          { key: "name", header: "Generator", render: (row) => row.name },
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
            key: "stored",
            header: "Stored",
            render: (row) => {
              const freshness = storedFreshness(row.updatedAt, Date.now());
              return freshness.stale ? `${freshness.label} · stale` : freshness.label;
            },
          },
        ]}
      />
      <SiteAlarmPanel organizationId={organizationId} siteId={siteId} permissions={permissions} />
    </div>
  );
}
