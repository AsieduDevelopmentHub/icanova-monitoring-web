import type { FormEvent } from "react";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";
import { formatReading } from "../telemetry/readings";
import { storedFreshness } from "../telemetry/freshness";
import { accessMessage, id, storedReading } from "./access";
import { FleetBoundary } from "./boundary";
import { gatewayIdentityError, normalizeGatewayIdentity } from "./gatewayIdentity";

type OrgRow = { organizationId: string; name: string; permissions: string[] };
type Named = { _id: string; name: string };

const firstPage = { numItems: 50, cursor: null };

export function OrgFleet() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return <p className="empty">Checking session…</p>;
  }
  if (!isAuthenticated) {
    return (
      <div className="notice" role="note">
        <strong>Not signed in.</strong> No organization query is running. The demo log below is not a
        fleet.{" "}
        <Link to="/auth/login">Sign in</Link> to load organizations.
      </div>
    );
  }
  return (
    <FleetBoundary>
      <SignedFleet />
    </FleetBoundary>
  );
}

function SignedFleet() {
  const orgs = useQuery(api.organizations.mine, {});
  const createOrg = useMutation(api.organizations.create);
  const [pickedOrg, setPickedOrg] = useState("");
  const [orgName, setOrgName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (orgs === undefined) {
    return <p className="empty">Loading organizations.</p>;
  }
  if (!Array.isArray(orgs)) {
    return <p className="empty">The organization list was not readable.</p>;
  }
  const listed = orgs as OrgRow[];
  const orgId = listed.some((org) => org.organizationId === pickedOrg)
    ? pickedOrg
    : (listed[0]?.organizationId ?? "");
  const selected = listed.find((org) => org.organizationId === orgId);

  async function onCreateOrg(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const id = await createOrg({ name: orgName });
      setPickedOrg(id);
      setOrgName("");
    } catch (error) {
      setFormError(accessMessage(error));
    }
  }

  return (
    <div className="stack">
      <div className="notice" role="note">
        <strong>One site.</strong> The table subscribes to current readings for the selected site, at
        most 50 generators. It does not subscribe to history or to other organizations. Permission
        names are a display hint. The server checks membership on every request.
      </div>
      <FilterBar label="Organization">
        <FilterSelect
          label="Organization"
          value={orgId}
          onChange={setPickedOrg}
          options={
            listed.length
              ? listed.map((org) => ({ value: org.organizationId, label: org.name }))
              : [{ value: "", label: "No organization" }]
          }
        />
      </FilterBar>
      {selected ? (
        <p className="meta">Displayed permissions: {selected.permissions.join(", ") || "none"}.</p>
      ) : (
        <p className="empty">This account has no organization membership.</p>
      )}
      <form className="filter-bar" onSubmit={onCreateOrg}>
        <label className="filter-field grow">
          <span>New organization</span>
          <input value={orgName} onChange={(event) => setOrgName(event.target.value)} />
        </label>
        <button type="submit">Create organization</button>
      </form>
      {formError ? <p className="err">{formError}</p> : null}
      {orgId ? (
        <FleetBoundary key={orgId}>
          <SiteColumn organizationId={id<"organizations">(orgId)} />
        </FleetBoundary>
      ) : null}
    </div>
  );
}

function SiteColumn({ organizationId }: { organizationId: Id<"organizations"> }) {
  const sites = useQuery(api.sites.list, { organizationId, paginationOpts: firstPage });
  const createSite = useMutation(api.sites.create);
  const [pickedSite, setPickedSite] = useState("");
  const [siteName, setSiteName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (sites === undefined) {
    return <p className="empty">Loading sites.</p>;
  }
  const page = Array.isArray(sites.page) ? (sites.page as Named[]) : [];
  const siteId = page.some((site) => site._id === pickedSite) ? pickedSite : (page[0]?._id ?? "");

  async function onCreateSite(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const created = await createSite({ organizationId, name: siteName });
      setPickedSite(created);
      setSiteName("");
    } catch (error) {
      setFormError(accessMessage(error));
    }
  }

  return (
    <div className="stack">
      <FilterBar label="Site">
        <FilterSelect
          label="Site"
          value={siteId}
          onChange={setPickedSite}
          options={
            page.length
              ? page.map((site) => ({ value: site._id, label: site.name }))
              : [{ value: "", label: "No site" }]
          }
        />
      </FilterBar>
      {sites.isDone === false ? (
        <p className="meta">More sites exist than this page. The selector shows the first 50.</p>
      ) : null}
      <form className="filter-bar" onSubmit={onCreateSite}>
        <label className="filter-field grow">
          <span>New site</span>
          <input value={siteName} onChange={(event) => setSiteName(event.target.value)} />
        </label>
        <button type="submit">Create site</button>
      </form>
      {formError ? <p className="err">{formError}</p> : null}
      {siteId ? (
        <Devices organizationId={organizationId} siteId={id<"sites">(siteId)} />
      ) : (
        <p className="empty">Create a site before adding a device.</p>
      )}
    </div>
  );
}

function Devices({
  organizationId,
  siteId,
}: {
  organizationId: Id<"organizations">;
  siteId: Id<"sites">;
}) {
  const devices = useQuery(api.devices.list, {
    organizationId,
    siteId,
    paginationOpts: firstPage,
  });
  const createDevice = useMutation(api.devices.create);
  const createGenerator = useMutation(api.generators.create);
  const [deviceName, setDeviceName] = useState("");
  const [identity, setIdentity] = useState("");
  const [generatorName, setGeneratorName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (devices === undefined) {
    return <p className="empty">Loading devices.</p>;
  }
  const page = Array.isArray(devices.page) ? (devices.page as Named[]) : [];
  const selectedDevice = page.some((device) => device._id === deviceId) ? deviceId : (page[0]?._id ?? "");

  async function onCreateDevice(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const identityError = gatewayIdentityError(identity);
    if (identityError) {
      setFormError(identityError);
      return;
    }
    try {
      await createDevice({
        organizationId,
        siteId,
        name: deviceName,
        identity: normalizeGatewayIdentity(identity),
      });
      setDeviceName("");
      setIdentity("");
    } catch (error) {
      setFormError(accessMessage(error));
    }
  }

  async function onCreateGenerator(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createGenerator({
        organizationId,
        siteId,
        deviceId: id<"devices">(selectedDevice),
        name: generatorName,
      });
      setGeneratorName("");
    } catch (error) {
      setFormError(accessMessage(error));
    }
  }

  return (
    <div className="stack">
      <form className="filter-bar" onSubmit={onCreateDevice}>
        <label className="filter-field">
          <span>Device name</span>
          <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} />
        </label>
        <label className="filter-field grow">
          <span>Gateway identity (efuse MAC)</span>
          <input
            className="tech"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            placeholder="a1b2c3d4e5f6"
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Register gateway
        </button>
      </form>
      <form className="filter-bar" onSubmit={onCreateGenerator}>
        <label className="filter-field">
          <span>Generator name</span>
          <input value={generatorName} onChange={(event) => setGeneratorName(event.target.value)} />
        </label>
        <FilterSelect
          label="Device"
          value={selectedDevice}
          onChange={setDeviceId}
          options={
            page.length
              ? page.map((device) => ({ value: device._id, label: device.name }))
              : [{ value: "", label: "No device" }]
          }
        />
        <button type="submit">Create generator</button>
      </form>
      {formError ? <p className="err">{formError}</p> : null}
      <FleetBoundary key={siteId}>
        <CurrentTable organizationId={organizationId} siteId={siteId} />
      </FleetBoundary>
    </div>
  );
}

function CurrentTable({
  organizationId,
  siteId,
}: {
  organizationId: Id<"organizations">;
  siteId: Id<"sites">;
}) {
  const data = useQuery(api.telemetry.currentForSite, { organizationId, siteId });
  if (data === undefined) {
    return <p className="empty">Loading current readings.</p>;
  }
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Current readings for this site</caption>
        <thead>
          <tr>
            <th>Generator</th>
            <th>Link</th>
            <th>Stored</th>
            <th>RPM</th>
            <th>Power</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6}>No generators on this site.</td>
            </tr>
          ) : (
            rows.map((row: { generatorId: string; name: string; link: string | null; updatedAt: number | null; rpm: number | null; rpmQuality: string; powerKw: number | null; powerQuality: string }) => {
              const rpm = storedReading(row.rpm, row.rpmQuality, "rpm");
              const power = storedReading(row.powerKw, row.powerQuality, "kW");
              const freshness = storedFreshness(row.updatedAt, Date.now());
              return (
                <tr key={row.generatorId}>
                  <td>{row.name}</td>
                  <td>{row.link ?? "—"}</td>
                  <td>
                    {freshness.stale ? <StatusMark tone="warn">stale</StatusMark> : null}{" "}
                    {freshness.label}
                  </td>
                  <td>
                    <StatusMark tone={rpm.quality === "measured" ? "neutral" : "warn"}>
                      {formatReading(rpm)}
                    </StatusMark>
                  </td>
                  <td>{formatReading(power)}</td>
                  <td>
                    <Link to={`/generators/${row.generatorId}`}>Open</Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {data.capped ? (
        <p className="meta">This site has more than 50 generators. The snapshot stops at 50.</p>
      ) : null}
    </div>
  );
}
