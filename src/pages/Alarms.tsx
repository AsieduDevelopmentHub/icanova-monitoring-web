import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FleetBoundary } from "../fleet/boundary";
import { accessMessage, id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { demoAlarms, filterAlarms, type AlarmKind } from "../telemetry/alarms";
import { DEMO_SOURCE } from "../telemetry/logModel";
import { demoSamples } from "../telemetry/demoLog";
import {
  alarmListCopy,
  alarmTime,
  canManageAlarms,
  filterAlarmCenter,
  pageBanner,
  severityTone,
  toAlarmRecord,
  type AlarmFilter,
  type StoredAlarmRow,
} from "../telemetry/alarmCenter";
import { AlarmPeek } from "../fleet/AlarmPeek";
import { DataTable } from "../ui/DataTable";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import { PageSkeleton } from "../ui/Skeleton";
import { Dialog } from "../ui/Overlay";
import { useDebouncedValue } from "../ui/useDebouncedValue";

const demoRows = demoAlarms(demoSamples);

const STATUSES = ["all", "active", "acknowledged", "cleared", "resolved"] as const;
const SEVERITIES = ["all", "critical", "warning", "informational"] as const;
const CATEGORIES = ["all", "communication", "generator", "gateway"] as const;

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

export function Alarms() {
  return (
    <section className="page ops-page">
      {import.meta.env.VITE_CONVEX_URL ? (
        <LiveGate
          emptyLayout="list"
          emptyCaption="Alarm center"
          emptyColumns={["Alarm", "Severity", "State", "Site", "Updated"]}
        >
          {(org) => (
            <OrgAlarms organizationId={org.organizationId} permissions={org.permissions} />
          )}
        </LiveGate>
      ) : (
        <DemoAlarmList />
      )}
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
      <p className="meta" role="note">
        Demo · {DEMO_SOURCE}
      </p>
      <FilterBar label="Demo alarm filters">
        <FilterSearch label="Search" value={search} onChange={setSearch} placeholder="Link, batch, page" />
        <FilterSelect
          label="Kind"
          searchable={false}
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
        exportTitle="Demo alarms"
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

function OrgAlarms({
  organizationId,
  permissions,
}: {
  organizationId: string;
  permissions: readonly string[];
}) {
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get("orgq") ?? "");
  const search = useDebouncedValue(searchDraft, 300);
  const status = oneOf(params.get("state"), STATUSES, "all");
  const severity = oneOf(params.get("severity"), SEVERITIES, "all");
  const category = oneOf(params.get("category"), CATEGORIES, "all");
  const siteId = params.get("site") ?? "";
  const generatorId = params.get("generator") ?? "";
  const scope = useQuery(api.alarms.scope, {
    organizationId: id<"organizations">(organizationId),
    siteId: siteId ? id<"sites">(siteId) : null,
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key === "site") {
      next.delete("generator");
    }
    setParams(next);
  }

  useEffect(() => {
    const current = params.get("orgq") ?? "";
    if (current === search) {
      return;
    }
    const next = new URLSearchParams(params);
    if (search) {
      next.set("orgq", search);
    } else {
      next.delete("orgq");
    }
    setParams(next, { replace: true });
  }, [search, params, setParams]);

  const sites = scope?.sites ?? [];
  const generators = scope?.generators ?? [];
  const siteValue =
    scope === undefined ? siteId : sites.some((site) => site.id === siteId) ? siteId : "";
  const generatorValue =
    scope === undefined
      ? generatorId
      : generators.some((generator) => generator.id === generatorId)
        ? generatorId
        : "";
  const filter: AlarmFilter = {
    status,
    severity,
    category,
    siteId: siteValue,
    generatorId: generatorValue,
    search,
  };

  return (
    <div className="stack alarm-board">
      {canManageAlarms(permissions) ? (
        <div className="alarm-toolbar">
          <RecordAlarm organizationId={organizationId} />
        </div>
      ) : null}
      <FilterBar label="Alarm filters">
        <FilterSearch label="Search" value={searchDraft} onChange={setSearchDraft} />
        <FilterSelect
          label="Status"
          searchable={false}
          value={status}
          onChange={(value) => setParam("state", value)}
          options={STATUSES.map((value) => ({ value, label: value === "all" ? "All statuses" : value }))}
        />
        <FilterSelect
          label="Severity"
          searchable={false}
          value={severity}
          onChange={(value) => setParam("severity", value)}
          options={SEVERITIES.map((value) => ({
            value,
            label: value === "all" ? "All severities" : value,
          }))}
        />
        <FilterSelect
          label="Category"
          searchable={false}
          value={category}
          onChange={(value) => setParam("category", value)}
          options={CATEGORIES.map((value) => ({
            value,
            label: value === "all" ? "All categories" : value,
          }))}
        />
        <FilterSelect
          label="Site"
          value={siteValue}
          onChange={(value) => setParam("site", value)}
          options={[
            { value: "", label: "All loaded sites" },
            ...sites.map((site) => ({ value: site.id, label: site.name })),
          ]}
        />
        <FilterSelect
          label="Generator"
          value={generatorValue}
          onChange={(value) => setParam("generator", value)}
          options={[
            { value: "", label: siteValue ? "All loaded generators" : "Choose a site" },
            ...generators.map((generator) => ({ value: generator.id, label: generator.name })),
          ]}
        />
      </FilterBar>
      {scope?.sitesCapped || scope?.generatorsCapped ? (
        <p className="meta">First 50.</p>
      ) : null}
      <FleetBoundary key={`${organizationId}:${status}:${severity}:${category}:${siteValue}:${generatorValue}:${search}`}>
        <AlarmTable organizationId={organizationId} filter={filter} permissions={permissions} />
      </FleetBoundary>
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
  const [open, setOpen] = useState(false);
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
    if (!device.siteId) {
      setError("Selected device is not assigned to a site.");
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
      setOpen(false);
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Record note
      </button>
      <Dialog open={open} title="Record note" onClose={() => setOpen(false)}>
    <form className="stack" onSubmit={onSubmit}>
      <FilterBar label="Record note">
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
          searchable={false}
          value={recordKind}
          onChange={(value) => setRecordKind(value === "controller" ? "controller" : "transport")}
          options={[
            { value: "transport", label: "Transport" },
            { value: "controller", label: "Controller note" },
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
        <button type="submit">Record note</button>
      </FilterBar>
      {error ? <p className="err">{error}</p> : null}
    </form>
      </Dialog>
    </>
  );
}

function AlarmTable({
  organizationId,
  filter,
  permissions,
}: {
  organizationId: string;
  filter: AlarmFilter;
  permissions: readonly string[];
}) {
  const [peekId, setPeekId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const narrowed =
    filter.status !== "all" ||
    filter.severity !== "all" ||
    filter.category !== "all" ||
    filter.generatorId !== "" ||
    filter.search !== "";
  const data = useQuery(api.alarms.list, {
    organizationId: id<"organizations">(organizationId),
    state: filter.status,
    kind: "all",
    deviceId: null,
    search: filter.search,
    severity: filter.severity,
    category: filter.category,
    siteId: filter.siteId ? id<"sites">(filter.siteId) : null,
    generatorId: filter.generatorId ? id<"generators">(filter.generatorId) : null,
    paginationOpts: { numItems: 50, cursor: narrowed ? null : cursor },
  });
  if (data === undefined) {
    return <PageSkeleton rows={6} label="Loading alarms" />;
  }
  const records = filterAlarmCenter((data.rows as StoredAlarmRow[]).map(toAlarmRecord), filter);
  const copy = alarmListCopy({
    status: filter.status,
    capped: Boolean(data.capped),
    filtered: narrowed || filter.siteId !== "",
  });
  const banner = pageBanner(records, filter.status);
  const active = records.filter((row) => row.status === "active").length;
  const acknowledged = records.filter((row) => row.status === "acknowledged").length;
  const cleared = records.filter((row) => row.status === "cleared" || row.status === "resolved").length;
  const critical = records.filter((row) => row.severity === "critical").length;
  const warning = records.filter((row) => row.severity === "warning").length;
  return (
    <div className="stack">
      <section className="ops-section" aria-labelledby="alarm-analytics-title">
        <h2 id="alarm-analytics-title">Summary</h2>
        {data.capped ? <p className="meta">Query capped.</p> : null}
        <div className="metric-grid metric-grid-3 alarm-summary-grid">
          <Metric label="Rows" value={String(records.length)} />
          <Metric label="Active" value={String(active)} />
          <Metric label="Ack" value={String(acknowledged)} />
          <Metric label="Cleared" value={String(cleared)} />
          <Metric label="Critical" value={String(critical)} />
          <Metric label="Warning" value={String(warning)} />
        </div>
      </section>
      {banner ? <p className="empty">{banner}</p> : null}
      <DataTable
        dense
        caption="Alarms"
        exportTitle="Alarms"
        rows={records}
        getRowKey={(row) => row.id}
        empty={copy.empty}
        renderMobileRow={(row) => (
          <article className={`alarm-list-card${row.status === "active" ? " is-active" : ""}`}>
            <header className="alarm-list-card-head">
              <StatusMark tone={severityTone(row.severity)}>{row.severity}</StatusMark>
              <StatusMark tone={row.status === "active" ? "alarm" : row.status === "acknowledged" ? "warn" : "neutral"}>
                {row.status}
              </StatusMark>
            </header>
            <button type="button" className="alarm-list-card-title" onClick={() => setPeekId(row.id)}>
              {row.title}
            </button>
            <dl className="alarm-list-card-facts">
              <div>
                <dt>Site</dt>
                <dd>{row.siteId ? <Link to={`/sites/${row.siteId}`}>{row.siteName}</Link> : row.siteName}</dd>
              </div>
              <div>
                <dt>Generator</dt>
                <dd>
                  {row.generatorId && row.siteId ? (
                    <Link to={`/sites/${row.siteId}/generators/${row.generatorId}`}>{row.generatorName}</Link>
                  ) : (
                    row.generatorName
                  )}
                </dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{row.category}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd className="tech">
                  {new Date(row.firstOccurredAt).toLocaleString(undefined, {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>
          </article>
        )}
        columns={[
          {
            key: "severity",
            header: "Severity",
            render: (row) => <StatusMark tone={severityTone(row.severity)}>{row.severity}</StatusMark>,
          },
          {
            key: "title",
            header: "Alarm",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                {row.title}
              </button>
            ),
          },
          {
            key: "site",
            header: "Site",
            render: (row) =>
              row.siteId ? <Link to={`/sites/${row.siteId}`}>{row.siteName}</Link> : row.siteName,
          },
          {
            key: "generator",
            header: "Generator",
            render: (row) =>
              row.generatorId && row.siteId ? (
                <Link to={`/sites/${row.siteId}/generators/${row.generatorId}`}>{row.generatorName}</Link>
              ) : (
                row.generatorName
              ),
          },
          {
            key: "first",
            header: "Started",
            render: (row) => <span className="tech">{alarmTime(row.firstOccurredAt)}</span>,
          },
          { key: "status", header: "Status", render: (row) => row.status },
          {
            key: "open",
            header: "",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeekId(row.id)}>
                Inspect
              </button>
            ),
          },
        ]}
      />
      {copy.note ? <p className="meta">{copy.note}</p> : null}
      {!narrowed && data.continueCursor && !data.isDone ? (
        <button type="button" onClick={() => setCursor(data.continueCursor)}>
          Next page
        </button>
      ) : null}
      <AlarmPeek alarmId={peekId} permissions={permissions} onClose={() => setPeekId(null)} />
    </div>
  );
}
