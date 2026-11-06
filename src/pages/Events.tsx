import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { siteGatewayPath, sitePath } from "../fleet/paths";
import { auditActor, auditTime } from "../telemetry/fleetView";
import { DataTable } from "../ui/DataTable";
import { Tabs } from "../ui/Tabs";
import { PageSkeleton } from "../ui/Skeleton";
import { Drawer } from "../ui/Overlay";
import { StatusMark } from "../ui/StatusMark";

type AuditRow = {
  _id: string;
  action: string;
  actorToken: string;
  target: string;
  at: number;
};

type HealthRow = {
  _id: string;
  at: number;
  deviceId: string;
  deviceIdentity?: string | null;
  deviceName: string;
  reason: string;
  gatewayTo?: string | null;
  modbusTo?: string | null;
  freshnessTo?: string | null;
  overallTo?: string | null;
};

type TimelineMode = "health" | "audit";

export function Events() {
  const [mode, setMode] = useState<TimelineMode>("health");
  return (
    <section className="page ops-page">
      <Tabs
        label="Timeline source"
        value={mode}
        onChange={setMode}
        items={[
          { id: "health", label: "Health" },
          { id: "audit", label: "Audit" },
        ]}
      />
      <LiveGate emptyLayout="list" emptyCaption="Events" emptyColumns={["When", "Source", "Change"]}>
        {(org) =>
          mode === "health" ? (
            <HealthWithSiteUrl organizationId={org.organizationId} />
          ) : (
            <AuditList organizationId={org.organizationId} />
          )
        }
      </LiveGate>
    </section>
  );
}

function HealthWithSiteUrl({ organizationId }: { organizationId: string }) {
  const [params, setParams] = useSearchParams();
  const siteFromUrl = params.get("site") ?? "";

  function onSiteChange(siteId: string | null) {
    const next = new URLSearchParams(params);
    if (siteId) {
      next.set("site", siteId);
    } else {
      next.delete("site");
    }
    setParams(next, { replace: true });
  }

  return (
    <SiteSelect
      organizationId={organizationId}
      initialSiteId={siteFromUrl || undefined}
      onSiteChange={onSiteChange}
    >
      {(siteId, siteName) =>
        siteId ? (
          <FleetBoundary key={siteId}>
            <HealthTimeline organizationId={organizationId} siteId={siteId} siteName={siteName} />
          </FleetBoundary>
        ) : null
      }
    </SiteSelect>
  );
}

function HealthTimeline({
  organizationId,
  siteId,
  siteName,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
}) {
  const pagination = useCursorPages();
  const data = useQuery(api.deviceHealth.recentPageForSite, {
    organizationId: id<"organizations">(organizationId),
    siteId,
    paginationOpts: { numItems: 25, cursor: pagination.cursor },
  });
  const [peek, setPeek] = useState<HealthRow | null>(null);
  if (data === undefined) {
    return <PageSkeleton rows={5} label="Loading health timeline" />;
  }
  return (
    <div className="stack">
      <p className="meta">
        <Link to={sitePath(siteId)}>{siteName}</Link>
        {" · "}
        <Link to={`/alarms?site=${siteId}`}>Alarms</Link>
      </p>
      <DataTable
        dense
        caption={`Events · ${siteName}`}
        exportTitle={`Events ${siteName}`}
        rows={data.page as HealthRow[]}
        getRowKey={(row) => row._id}
        empty="No health transitions for this site."
        columns={[
          {
            key: "at",
            header: "When",
            render: (row) => (
              <span className="tech">
                {new Date(row.at).toLocaleString(undefined, {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ),
          },
          {
            key: "device",
            header: "Gateway",
            render: (row) => (
              <Link to={siteGatewayPath(siteId, row.deviceIdentity ?? row.deviceId)}>{row.deviceName}</Link>
            ),
          },
          {
            key: "reason",
            header: "Event",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => setPeek(row)}>
                {row.reason}
              </button>
            ),
          },
          {
            key: "change",
            header: "Change",
            render: (row) => {
              const parts = [
                row.gatewayTo ? `cloud → ${row.gatewayTo}` : null,
                row.modbusTo ? `modbus → ${row.modbusTo}` : null,
                row.freshnessTo ? `freshness → ${row.freshnessTo}` : null,
                row.overallTo ? `overall → ${row.overallTo}` : null,
              ].filter(Boolean);
              return parts.length > 0 ? parts.join(" · ") : "—";
            },
          },
        ]}
      />
      <Drawer open={Boolean(peek)} title="Health event" side="right" onClose={() => setPeek(null)}>
        {peek ? (
          <div className="stack alarm-peek">
            <h3>{peek.reason}</h3>
            <dl className="facts">
              <dt>When</dt>
              <dd className="tech">{new Date(peek.at).toLocaleString()}</dd>
              <dt>Gateway</dt>
              <dd>
                <Link
                  to={siteGatewayPath(siteId, peek.deviceIdentity ?? peek.deviceId)}
                  onClick={() => setPeek(null)}
                >
                  {peek.deviceName}
                </Link>
              </dd>
              <dt>Site</dt>
              <dd>
                <Link to={sitePath(siteId)} onClick={() => setPeek(null)}>
                  {siteName}
                </Link>
              </dd>
              <dt>Cloud</dt>
              <dd>{peek.gatewayTo ? <StatusMark tone="neutral">{peek.gatewayTo}</StatusMark> : "—"}</dd>
              <dt>Modbus</dt>
              <dd>{peek.modbusTo ? <StatusMark tone="neutral">{peek.modbusTo}</StatusMark> : "—"}</dd>
              <dt>Freshness</dt>
              <dd>{peek.freshnessTo ?? "—"}</dd>
              <dt>Overall</dt>
              <dd>{peek.overallTo ?? "—"}</dd>
            </dl>
          </div>
        ) : null}
      </Drawer>
      <CursorPager
        pageNumber={pagination.pageNumber}
        canGoNewer={pagination.canGoNewer}
        canGoOlder={!data.isDone && Boolean(data.continueCursor)}
        onNewest={pagination.goNewest}
        onNewer={pagination.goNewer}
        onOlder={() => pagination.goOlder(data.continueCursor)}
      />
    </div>
  );
}

function AuditList({ organizationId }: { organizationId: string }) {
  const pagination = useCursorPages();
  const data = useQuery(api.audits.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor: pagination.cursor },
  });
  if (data === undefined) {
    return <PageSkeleton rows={5} label="Loading audit events" />;
  }
  const page = (Array.isArray(data.page) ? data.page : []) as AuditRow[];
  return (
    <div className="stack">
      <DataTable
        dense
        caption="Audit"
        exportTitle="Audit events"
        rows={page}
        getRowKey={(row) => row._id}
        empty="No audit events."
        columns={[
          { key: "time", header: "Time", render: (row) => <span className="tech">{auditTime(row.at)}</span> },
          { key: "action", header: "Action", render: (row) => row.action },
          { key: "actor", header: "Actor", render: (row) => auditActor(row.actorToken) },
          { key: "target", header: "Resource", render: (row) => <span className="tech">{row.target}</span> },
        ]}
      />
      <CursorPager
        pageNumber={pagination.pageNumber}
        canGoNewer={pagination.canGoNewer}
        canGoOlder={!data.isDone && Boolean(data.continueCursor)}
        onNewest={pagination.goNewest}
        onNewer={pagination.goNewer}
        onOlder={() => pagination.goOlder(data.continueCursor)}
      />
    </div>
  );
}

function useCursorPages() {
  const [state, setState] = useState({
    cursors: [null] as (string | null)[],
    index: 0,
  });

  return {
    cursor: state.cursors[state.index] ?? null,
    pageNumber: state.index + 1,
    canGoNewer: state.index > 0,
    goNewest: () => setState((current) => ({ ...current, index: 0 })),
    goNewer: () =>
      setState((current) => ({ ...current, index: Math.max(0, current.index - 1) })),
    goOlder: (cursor: string) =>
      setState((current) => {
        const nextIndex = current.index + 1;
        if (nextIndex < current.cursors.length) {
          return { ...current, index: nextIndex };
        }
        return { cursors: [...current.cursors, cursor], index: nextIndex };
      }),
  };
}

function CursorPager({
  pageNumber,
  canGoNewer,
  canGoOlder,
  onNewest,
  onNewer,
  onOlder,
}: {
  pageNumber: number;
  canGoNewer: boolean;
  canGoOlder: boolean;
  onNewest: () => void;
  onNewer: () => void;
  onOlder: () => void;
}) {
  return (
    <nav className="cursor-pager" aria-label="Pagination">
      <button type="button" className="btn btn-secondary" disabled={!canGoNewer} onClick={onNewest}>
        Newest
      </button>
      <button type="button" className="btn btn-secondary" disabled={!canGoNewer} onClick={onNewer}>
        Newer
      </button>
      <span className="meta" aria-live="polite">
        Page {pageNumber}
      </span>
      <button type="button" className="btn btn-secondary" disabled={!canGoOlder} onClick={onOlder}>
        Older
      </button>
    </nav>
  );
}
