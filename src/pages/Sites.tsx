import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { accessMessage, id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { SiteAlarmPanel } from "../fleet/AlarmPanel";
import { engineView, linkView, registrationLabel, snapshotScope } from "../telemetry/fleetView";
import { storedFreshness } from "../telemetry/freshness";
import {
  contactAgeLabel,
  gatewayView,
  modbusView,
  overallView,
} from "../telemetry/deviceHealthView";
import { DataTable } from "../ui/DataTable";
import { StatusMark } from "../ui/StatusMark";

type SiteRow = { _id: string; name: string };

export function Sites() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Sites</h1>
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
  const canManage = permissions.includes("manage.sites");
  if (sites === undefined) {
    return <p className="empty">Loading sites.</p>;
  }
  const page = (Array.isArray(sites.page) ? sites.page : []) as SiteRow[];
  const selected = page.find((site) => site._id === picked) ?? page[0];
  return (
    <div className="stack">
      {canManage ? (
        <CreateSite
          organizationId={organizationId}
          onCreated={(siteId) => setPicked(siteId)}
        />
      ) : (
        <p className="meta">Creating sites requires manage.sites.</p>
      )}
      {page.length === 0 ? (
        <p className="empty">
          No sites are registered in this organization. Create one before attaching a gateway.
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
                <button type="button" className="btn btn-secondary" onClick={() => setPicked(row._id)}>
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
          <button type="button" className="btn btn-secondary" onClick={() => setCursor(sites.continueCursor)}>
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

function CreateSite({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: (siteId: string) => void;
}) {
  const createSite = useMutation(api.sites.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const siteId = await createSite({
        organizationId: id<"organizations">(organizationId),
        name,
      });
      setName("");
      onCreated(siteId);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ops-section" aria-labelledby="site-create-title">
      <h2 id="site-create-title">Create site</h2>
      <form className="filter-bar" onSubmit={(event) => void onSubmit(event)}>
        <label className="filter-field grow">
          <span>Site name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create site"}
        </button>
      </form>
      {error ? <p className="err">{error}</p> : null}
    </section>
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
  const [renameValue, setRenameValue] = useState(siteName);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renamePending, setRenamePending] = useState(false);
  const renameSite = useMutation(api.sites.rename);
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
  const gateways = useQuery(api.devices.siteHealth, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
  const canManage = permissions.includes("manage.sites");

  if (generators === undefined || current === undefined || summary === undefined || gateways === undefined) {
    return <p className="empty">Loading {siteName}.</p>;
  }
  const registered = Array.isArray(generators.page) ? generators.page : [];
  const readings = Array.isArray(current.rows) ? current.rows : [];
  const scope = snapshotScope(readings, Boolean(current.capped));
  const now = Date.now();

  async function onRename(event: FormEvent) {
    event.preventDefault();
    setRenameError(null);
    setRenamePending(true);
    try {
      await renameSite({
        organizationId: id<"organizations">(organizationId),
        siteId,
        name: renameValue,
      });
    } catch (caught) {
      setRenameError(accessMessage(caught));
    } finally {
      setRenamePending(false);
    }
  }

  return (
    <div className="stack">
      <h2>{siteName}</h2>
      {canManage ? (
        <form className="filter-bar" onSubmit={(event) => void onRename(event)}>
          <label className="filter-field grow">
            <span>Rename site</span>
            <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-secondary" disabled={renamePending}>
            {renamePending ? "Saving…" : "Save name"}
          </button>
        </form>
      ) : null}
      {renameError ? <p className="err">{renameError}</p> : null}
      <p className="meta">{registrationLabel(registered.length, generators.isDone !== false)}</p>
      <p className="meta">
        {summary.ready
          ? `Site summary: ${summary.generators === null ? "generators not fully counted" : `${summary.generators} generators`}, ${summary.reporting} reporting, gateways ${summary.gatewayOnline ?? 0} online / ${summary.gatewayOffline ?? 0} offline, Modbus ${summary.linkOk} ok / ${summary.linkFail} fail / ${summary.linkDegraded} degraded, telemetry fresh ${summary.telemetryFresh ?? 0} / stale ${summary.telemetryStale ?? 0}.`
          : "Site summary is stored when a generator is registered or a sample arrives."}{" "}
        This page of Modbus links: {scope.modbusOk} ok, {scope.modbusFail} fail, {scope.modbusDegraded}{" "}
        degraded, {scope.unknown} unknown. {scope.note}
      </p>

      <section className="ops-section" aria-labelledby="site-gateways-title">
        <h2 id="site-gateways-title">Assigned gateways</h2>
        <DataTable
          caption={`Gateways at ${siteName}`}
          rows={gateways.rows}
          getRowKey={(row) => row._id}
          empty="No gateways are assigned to this site."
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
              key: "cloud",
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
              key: "overall",
              header: "Overall",
              render: (row) => {
                const view = overallView(row.overallStatus);
                return <StatusMark tone={view.tone}>{view.label}</StatusMark>;
              },
            },
            {
              key: "seen",
              header: "Last contact",
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
          <Link to="/gateways">Register another gateway</Link>
        </p>
      </section>

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
        <button type="button" className="btn btn-secondary" onClick={() => setCursor(generators.continueCursor)}>
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
