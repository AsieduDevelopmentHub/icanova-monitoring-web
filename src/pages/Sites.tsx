import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { engineView, linkView, registrationLabel, snapshotScope } from "../telemetry/fleetView";
import { storedFreshness } from "../telemetry/freshness";
import { DataTable } from "../ui/DataTable";
import { StatusMark } from "../ui/StatusMark";

type SiteRow = { _id: string; name: string };

export function Sites() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Sites</h1>
        <p>Sites in the signed-in organization. A site record stores a name. It has no location field.</p>
      </header>
      <LiveGate>{(org) => <SiteList organizationId={org.organizationId} />}</LiveGate>
    </section>
  );
}

function SiteList({ organizationId }: { organizationId: string }) {
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
        <SiteDetail
          organizationId={organizationId}
          siteId={id<"sites">(selected._id)}
          siteName={selected.name}
        />
      ) : null}
    </div>
  );
}

function SiteDetail({
  organizationId,
  siteId,
  siteName,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
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
  if (generators === undefined || current === undefined) {
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
        Links in the current snapshot: {scope.online} online, {scope.offline} offline, {scope.degraded}{" "}
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
            header: "Link",
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
    </div>
  );
}
