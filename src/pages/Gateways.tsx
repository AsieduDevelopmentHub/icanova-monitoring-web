import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { accessMessage, id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import { gatewayIdentityError, normalizeGatewayIdentity } from "../fleet/gatewayIdentity";
import { useBearerToken } from "../fleet/useBearer";
import { demoFrames } from "../telemetry/demoLog";
import { DEMO_GENERATOR_ID, DEMO_SOURCE } from "../telemetry/logModel";
import {
  contactAgeLabel,
  freshnessView,
  gatewayView,
  modbusView,
  overallView,
} from "../telemetry/deviceHealthView";
import { DataTable } from "../ui/DataTable";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";

export function Gateways() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Gateways</h1>
        <p>
          Manage iCanOva Edge Gateway registrations for one organization. Inventory is cloud metadata —
          this page does not push Modbus settings to the Soft-AP.
        </p>
      </header>
      {import.meta.env.VITE_CONVEX_URL ? <SignedInventory /> : null}
      <DemoInventory />
    </section>
  );
}

function DemoInventory() {
  const device = demoFrames[0]?.device ?? "DSE 7320 / 7320 MKII";
  return (
    <div className="stack">
      <div className="notice fixture" role="note">
        <strong>Demo log.</strong> One device name appears in {DEMO_SOURCE}. It is not an inventory
        database and it is not a live gateway.
      </div>
      <DataTable
        caption="Demo device from the log excerpt"
        rows={[{ id: DEMO_GENERATOR_ID, name: device }]}
        getRowKey={(row) => row.id}
        empty="The log excerpt has no device line."
        columns={[
          { key: "name", header: "Device", render: (row) => row.name },
          {
            key: "open",
            header: "",
            render: (row) => <Link to={`/gateways/${row.id}`}>Open diagnostics</Link>,
          },
        ]}
      />
    </div>
  );
}

function SignedInventory() {
  const token = useBearerToken();
  if (!token) {
    return (
      <div className="notice" role="note">
        <strong>Not signed in.</strong> No device query is running.{" "}
        <Link to="/auth/login">Sign in</Link> to load devices.
      </div>
    );
  }
  return (
    <FleetBoundary>
      <OrgInventory />
    </FleetBoundary>
  );
}

function OrgInventory() {
  const orgs = useQuery(api.organizations.mine, {});
  const [picked, setPicked] = useState("");
  const [params, setParams] = useSearchParams();
  if (orgs === undefined) {
    return <p className="empty">Loading organizations.</p>;
  }
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return <p className="empty">This account has no organization membership.</p>;
  }
  const org = orgs.find((item) => item.organizationId === picked) ?? orgs[0];
  const orgId = org.organizationId;
  const search = params.get("deviceq") ?? "";
  const siteFilter = params.get("site") ?? "";
  const statusFilter = params.get("gwstatus") ?? "all";
  const canManage = org.permissions.includes("manage.devices");

  return (
    <div className="stack">
      <div className="notice" role="note">
        <strong>Provisioning.</strong> Register the gateway with its 12-character efuse MAC identity,
        assign a site, then attach generators. Cloud Online means heartbeat/ingest contact — not Modbus.
        Soft-AP Modbus configuration stays on the local Configure page.
      </div>
      <FilterBar label="Gateway filters">
        <FilterSelect
          label="Organization"
          value={orgId}
          onChange={setPicked}
          options={orgs.map((item) => ({ value: item.organizationId, label: item.name }))}
        />
        <FilterSearch
          label="Search"
          value={search}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value) {
              next.set("deviceq", value);
            } else {
              next.delete("deviceq");
            }
            setParams(next);
          }}
          placeholder="Name or identity"
        />
        <FilterSelect
          label="Cloud status"
          value={statusFilter}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value === "all") {
              next.delete("gwstatus");
            } else {
              next.set("gwstatus", value);
            }
            setParams(next);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "online", label: "Online" },
            { value: "offline", label: "Offline" },
            { value: "unknown", label: "Unknown" },
          ]}
        />
      </FilterBar>
      <FleetBoundary key={`health:${orgId}`}>
        <OrgHealth organizationId={orgId} />
      </FleetBoundary>
      {canManage ? (
        <FleetBoundary key={`register:${orgId}`}>
          <RegisterGateway organizationId={orgId} siteFilter={siteFilter} onSiteFilter={setSiteParam} />
        </FleetBoundary>
      ) : (
        <p className="meta">Gateway registration requires manage.devices.</p>
      )}
      <FleetBoundary key={`${orgId}:${search}:${statusFilter}:${siteFilter}`}>
        <DeviceTable
          organizationId={orgId}
          search={search}
          statusFilter={statusFilter}
          siteFilter={siteFilter}
          onSiteFilter={setSiteParam}
        />
      </FleetBoundary>
    </div>
  );

  function setSiteParam(value: string) {
    const next = new URLSearchParams(params);
    if (value) {
      next.set("site", value);
    } else {
      next.delete("site");
    }
    setParams(next);
  }
}

function OrgHealth({ organizationId }: { organizationId: string }) {
  const summary = useQuery(api.deviceHealth.orgSummary, {
    organizationId: id<"organizations">(organizationId),
  });
  if (summary === undefined) {
    return <p className="empty">Loading fleet health.</p>;
  }
  if (!summary.ready) {
    return (
      <p className="meta">
        Fleet health tallies appear after the first heartbeat or accepted ingest for a device.
      </p>
    );
  }
  return (
    <p className="meta">
      Fleet: {summary.devicesTracked} tracked · gateways {summary.gatewayOnline} online /{" "}
      {summary.gatewayOffline} offline / {summary.gatewayUnknown} unknown · Modbus {summary.modbusOk}{" "}
      ok / {summary.modbusFail} fail · telemetry {summary.telemetryFresh} fresh /{" "}
      {summary.telemetryStale} stale / {summary.telemetryMissing} missing · overall{" "}
      {summary.overallUnhealthy} unhealthy · {summary.activeCommProblems} active communication
      problems. Incremental tallies, not a live scan.
    </p>
  );
}

function RegisterGateway({
  organizationId,
  siteFilter,
  onSiteFilter,
}: {
  organizationId: string;
  siteFilter: string;
  onSiteFilter: (value: string) => void;
}) {
  const sites = useQuery(api.sites.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor: null },
  });
  const createDevice = useMutation(api.devices.create);
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (sites === undefined) {
    return <p className="empty">Loading sites for registration.</p>;
  }
  const page = Array.isArray(sites.page) ? sites.page : [];
  const siteId = page.some((site) => site._id === siteFilter) ? siteFilter : (page[0]?._id ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setOk(null);
    const identityError = gatewayIdentityError(identity);
    if (identityError) {
      setError(identityError);
      return;
    }
    if (!siteId) {
      setError("Create a site before registering a gateway.");
      return;
    }
    setPending(true);
    try {
      const deviceId = await createDevice({
        organizationId: id<"organizations">(organizationId),
        siteId: id<"sites">(siteId),
        name,
        identity: normalizeGatewayIdentity(identity),
      });
      setName("");
      setIdentity("");
      setOk(`Registered. Open the gateway detail for ${deviceId}.`);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ops-section" aria-labelledby="gw-register-title">
      <h2 id="gw-register-title">Register gateway</h2>
      <p className="meta">
        Product: iCanOva Edge Gateway. Identity must match the device MAC used for ingest. Duplicate
        identities are rejected inside the organization.
      </p>
      {page.length === 0 ? (
        <p className="empty">
          No sites yet. Create one on <Link to="/sites">Sites</Link> or Generators first.
        </p>
      ) : (
        <form className="filter-bar" onSubmit={(event) => void onSubmit(event)}>
          <label className="filter-field">
            <span>Gateway name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Plant edge 1"
              required
            />
          </label>
          <label className="filter-field grow">
            <span>Identity (efuse MAC)</span>
            <input
              className="tech"
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder="a1b2c3d4e5f6"
              required
            />
          </label>
          <FilterSelect
            label="Site"
            value={siteId}
            onChange={onSiteFilter}
            options={page.map((site) => ({ value: site._id, label: site.name }))}
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Registering…" : "Register gateway"}
          </button>
        </form>
      )}
      {error ? <p className="err">{error}</p> : null}
      {ok ? <p className="meta">{ok}</p> : null}
    </section>
  );
}

function DeviceTable({
  organizationId,
  search,
  statusFilter,
  siteFilter,
  onSiteFilter,
}: {
  organizationId: string;
  search: string;
  statusFilter: string;
  siteFilter: string;
  onSiteFilter: (value: string) => void;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const data = useQuery(api.devices.inventory, {
    organizationId: id<"organizations">(organizationId),
    search,
    paginationOpts: { numItems: 50, cursor: search ? null : cursor },
  });
  const sites = useQuery(api.sites.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor: null },
  });
  const siteOptions = useMemo(() => {
    const page = Array.isArray(sites?.page) ? sites.page : [];
    return [{ value: "", label: "All sites" }, ...page.map((site) => ({ value: site._id, label: site.name }))];
  }, [sites]);

  if (data === undefined) {
    return <p className="empty">Loading devices.</p>;
  }
  const now = Date.now();
  const rows = data.rows.filter((row) => {
    if (statusFilter !== "all" && row.gatewayStatus !== statusFilter) {
      return false;
    }
    if (siteFilter && row.siteId !== siteFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="stack">
      <FilterBar label="Site filter">
        <FilterSelect label="Site" value={siteFilter} onChange={onSiteFilter} options={siteOptions} />
      </FilterBar>
      <DataTable
        caption="iCanOva Edge gateways in this organization"
        rows={rows}
        getRowKey={(row) => row._id}
        empty="No gateways match these filters."
        columns={[
          {
            key: "name",
            header: "Gateway",
            render: (row) => <Link to={`/gateways/${row._id}`}>{row.name}</Link>,
          },
          {
            key: "product",
            header: "Product",
            render: () => "iCanOva Edge Gateway",
          },
          {
            key: "identity",
            header: "Identity",
            render: (row) => <span className="tech">{row.identity}</span>,
          },
          { key: "site", header: "Site", render: (row) => row.siteName ?? "—" },
          {
            key: "lifecycle",
            header: "Lifecycle",
            render: (row) => (
              <StatusMark tone={row.lifecycle === "inactive" ? "alarm" : "ok"}>
                {row.lifecycle === "inactive" ? "Inactive" : "Active"}
              </StatusMark>
            ),
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
            header: "Last contact",
            render: (row) => contactAgeLabel(row.lastGatewayContactAt, now),
          },
          {
            key: "gens",
            header: "Generators",
            align: "right",
            render: (row) => String(row.generatorCount),
          },
          {
            key: "fw",
            header: "Firmware",
            render: () => "—",
          },
          {
            key: "open",
            header: "",
            render: (row) => <Link to={`/gateways/${row._id}`}>Open</Link>,
          },
        ]}
      />
      {data.capped ? <p className="meta">Search stopped after 200 devices.</p> : null}
      {!search && data.continueCursor && !data.isDone ? (
        <button type="button" className="btn btn-secondary" onClick={() => setCursor(data.continueCursor)}>
          Next page
        </button>
      ) : null}
      <p className="meta">
        Firmware version is not stored. Configuration status is Soft-AP local only — see gateway
        detail.
      </p>
    </div>
  );
}
