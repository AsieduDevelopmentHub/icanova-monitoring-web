import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FleetBoundary } from "../fleet/boundary";
import { accessMessage, id } from "../fleet/access";
import { useBearerToken } from "../fleet/useBearer";
import { demoAlarms, filterAlarms, type AlarmKind } from "../telemetry/alarms";
import { DEMO_SOURCE } from "../telemetry/logModel";
import { demoSamples } from "../telemetry/demoLog";
import { DataTable } from "../ui/DataTable";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";

const demoRows = demoAlarms(demoSamples);

export function Alarms() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Alarms</h1>
        <p>Transport failures stay separate from controller alarms. Lifecycle actions are checked in Convex.</p>
      </header>
      {import.meta.env.VITE_CONVEX_URL ? <SignedAlarms /> : null}
      <DemoAlarmList />
    </section>
  );
}

function DemoAlarmList() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const kindParam = params.get("kind");
  const kind: "all" | AlarmKind = kindParam === "transport" || kindParam === "controller" ? kindParam : "all";
  const rows = filterAlarms(demoRows, search, kind);

  function setKind(value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") {
      next.delete("kind");
    } else {
      next.set("kind", value);
    }
    setParams(next);
  }

  function setSearch(value: string) {
    const next = new URLSearchParams(params);
    if (value) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    setParams(next);
  }

  return (
    <div className="stack">
      <div className="notice fixture" role="note">
        <strong>Demo log.</strong> Rows come from {DEMO_SOURCE}. Acknowledgement is not stored for these
        rows. Alarm-page FAIL is a failed read, listed as transport.
      </div>
      <FilterBar label="Demo alarm filters">
        <FilterSearch label="Search" value={search} onChange={setSearch} placeholder="Link, batch, page" />
        <FilterSelect
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All kinds" },
            { value: "transport", label: "Transport" },
            { value: "controller", label: "Controller" },
          ]}
        />
      </FilterBar>
      <DataTable
        caption="Demo alarms from the log excerpt"
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          kind === "controller"
            ? "No controller alarms are in the log. Transport rows are a different filter."
            : "No rows match this filter."
        }
        columns={[
          {
            key: "kind",
            header: "Kind",
            render: (row) => (
              <StatusMark tone={row.kind === "transport" ? "warn" : "alarm"}>{row.kind}</StatusMark>
            ),
          },
          { key: "summary", header: "Summary", render: (row) => row.summary },
          {
            key: "open",
            header: "",
            render: (row) => <Link to={`/alarms/${row.id}`}>Open</Link>,
          },
        ]}
      />
    </div>
  );
}

function SignedAlarms() {
  const token = useBearerToken();
  if (!token) {
    return (
      <div className="notice" role="note">
        <strong>Not signed in.</strong> No organization alarm query is running.
      </div>
    );
  }
  return (
    <FleetBoundary>
      <OrgAlarms />
    </FleetBoundary>
  );
}

function OrgAlarms() {
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
  const search = params.get("orgq") ?? "";
  const state = params.get("state") ?? "all";
  const kind = params.get("orgkind") ?? "all";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next);
  }

  return (
    <div className="stack">
      <div className="notice" role="note">
        <strong>Organization alarms.</strong> Recording an alarm does not write to the controller.
        The server checks manage.alarms before any change.
      </div>
      <FilterBar label="Organization">
        <FilterSelect
          label="Organization"
          value={orgId}
          onChange={setPicked}
          options={orgs.map((org) => ({ value: org.organizationId, label: org.name }))}
        />
        <FilterSearch label="Search" value={search} onChange={(value) => setParam("orgq", value)} />
        <FilterSelect
          label="State"
          value={state}
          onChange={(value) => setParam("state", value)}
          options={[
            { value: "all", label: "All states" },
            { value: "active", label: "Active" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "cleared", label: "Cleared" },
            { value: "resolved", label: "Resolved" },
          ]}
        />
        <FilterSelect
          label="Kind"
          value={kind}
          onChange={(value) => setParam("orgkind", value)}
          options={[
            { value: "all", label: "All kinds" },
            { value: "transport", label: "Transport" },
            { value: "controller", label: "Controller" },
          ]}
        />
      </FilterBar>
      <FleetBoundary key={`${orgId}:${state}:${kind}:${search}`}>
        <AlarmTable
          organizationId={orgId}
          search={search}
          state={state}
          kind={kind}
        />
      </FleetBoundary>
      <RecordAlarm organizationId={orgId} />
    </div>
  );
}

function RecordAlarm({ organizationId }: { organizationId: string }) {
  const devices = useQuery(api.devices.inventory, {
    organizationId: id<"organizations">(organizationId),
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  const raise = useMutation(api.alarms.raise);
  const [deviceId, setDeviceId] = useState("");
  const [recordKind, setRecordKind] = useState<"transport" | "controller">("transport");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const page = devices?.rows ?? [];
  const selected = page.some((device) => device._id === deviceId) ? deviceId : (page[0]?._id ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const device = page.find((item) => item._id === selected);
    if (!device) {
      setError("Create a device before recording an alarm.");
      return;
    }
    setError(null);
    try {
      await raise({
        organizationId: id<"organizations">(organizationId),
        siteId: device.siteId,
        deviceId: device._id,
        generatorId: null,
        kind: recordKind,
        summary,
        detail,
        sourceTime: null,
      });
      setSummary("");
      setDetail("");
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h2>Record an alarm</h2>
      <p className="meta">This stores an operator record. It does not send a start, stop, or register write.</p>
      <FilterBar label="Record an alarm">
        <FilterSelect
          label="Device"
          value={selected}
          onChange={setDeviceId}
          options={
            page.length
              ? page.map((device) => ({ value: device._id, label: device.name }))
              : [{ value: "", label: "No device" }]
          }
        />
        <FilterSelect
          label="Record as"
          value={recordKind}
          onChange={(value) => setRecordKind(value === "controller" ? "controller" : "transport")}
          options={[
            { value: "transport", label: "Transport" },
            { value: "controller", label: "Controller" },
          ]}
        />
        <label className="filter-field">
          <span>Summary</span>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="filter-field grow">
          <span>Detail</span>
          <input value={detail} onChange={(event) => setDetail(event.target.value)} />
        </label>
        <button type="submit">Record alarm</button>
      </FilterBar>
      {error ? <p className="err">{error}</p> : null}
    </form>
  );
}

function AlarmTable({
  organizationId,
  search,
  state,
  kind,
}: {
  organizationId: string;
  search: string;
  state: string;
  kind: string;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const filtered = state !== "all" || kind !== "all" || search !== "";
  const data = useQuery(api.alarms.list, {
    organizationId: id<"organizations">(organizationId),
    state: state === "active" || state === "acknowledged" || state === "cleared" || state === "resolved" ? state : "all",
    kind: kind === "controller" || kind === "transport" ? kind : "all",
    deviceId: null,
    search,
    paginationOpts: { numItems: 50, cursor: filtered ? null : cursor },
  });
  if (data === undefined) {
    return <p className="empty">Loading alarms.</p>;
  }
  return (
    <div className="stack">
      <DataTable
        caption="Stored alarms for this organization"
        rows={data.rows}
        getRowKey={(row) => row._id}
        empty="No stored alarms match this filter."
        columns={[
          {
            key: "kind",
            header: "Kind",
            render: (row) => (
              <StatusMark tone={row.kind === "transport" ? "warn" : "alarm"}>{row.kind}</StatusMark>
            ),
          },
          { key: "state", header: "State", render: (row) => row.state },
          { key: "summary", header: "Summary", render: (row) => row.summary },
          {
            key: "open",
            header: "",
            render: (row) => <Link to={`/alarms/${row._id}`}>Open</Link>,
          },
        ]}
      />
      {data.capped ? <p className="meta">The filter read stopped at 200 alarms.</p> : null}
      {!filtered && data.continueCursor && !data.isDone ? (
        <button type="button" onClick={() => setCursor(data.continueCursor)}>
          Next page
        </button>
      ) : null}
    </div>
  );
}
