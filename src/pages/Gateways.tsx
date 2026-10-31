import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import { useBearerToken } from "../fleet/useBearer";
import { demoFrames } from "../telemetry/demoLog";
import { DEMO_GENERATOR_ID, DEMO_SOURCE } from "../telemetry/logModel";
import {
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
          iCanOva Edge device inventory is scoped to one organization. This page does not write to a
          controller.
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
  const orgId = orgs.some((org) => org.organizationId === picked) ? picked : orgs[0].organizationId;
  const search = params.get("deviceq") ?? "";
  return (
    <div className="stack">
      <div className="notice" role="note">
        <strong>Stored devices.</strong> Search covers the first 200 devices in this organization when
        a search term is set. The demo log below is not this list. Gateway Online is cloud contact, not
        Modbus.
      </div>
      <FilterBar label="Device search">
        <FilterSelect
          label="Organization"
          value={orgId}
          onChange={setPicked}
          options={orgs.map((org) => ({ value: org.organizationId, label: org.name }))}
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
      </FilterBar>
      <FleetBoundary key={`health:${orgId}`}>
        <OrgHealth organizationId={orgId} />
      </FleetBoundary>
      <FleetBoundary key={`${orgId}:${search}`}>
        <DeviceTable organizationId={orgId} search={search} />
      </FleetBoundary>
    </div>
  );
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

function DeviceTable({ organizationId, search }: { organizationId: string; search: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const data = useQuery(api.devices.inventory, {
    organizationId: id<"organizations">(organizationId),
    search,
    paginationOpts: { numItems: 50, cursor: search ? null : cursor },
  });
  if (data === undefined) {
    return <p className="empty">Loading devices.</p>;
  }
  return (
    <div className="stack">
      <DataTable
        caption="Devices in this organization"
        rows={data.rows}
        getRowKey={(row) => row._id}
        empty="No devices match this search."
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "identity", header: "Identity", render: (row) => row.identity },
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
            header: "Gateway",
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
            key: "open",
            header: "",
            render: (row) => <Link to={`/gateways/${row._id}`}>Open</Link>,
          },
        ]}
      />
      {data.capped ? <p className="meta">Search stopped after 200 devices.</p> : null}
      {!search && data.continueCursor && !data.isDone ? (
        <button type="button" onClick={() => setCursor(data.continueCursor)}>
          Next page
        </button>
      ) : null}
    </div>
  );
}

