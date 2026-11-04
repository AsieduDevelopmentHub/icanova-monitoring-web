import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import {
  siteAlarmsPath,
  siteEventsPath,
  siteGatewayPath,
  siteMaintenancePath,
  siteTrendsPath,
} from "../fleet/paths";
import { LiveGate } from "../fleet/scope";
import { SiteLocationPicker } from "../sites/SiteLocationPicker";
import { storedFreshness } from "../telemetry/freshness";
import { EmptyState } from "../ui/EmptyState";
import { QueryErrorBoundary } from "../ui/QueryErrorBoundary";
import { PageSkeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";
import { CommandBoard } from "./dashboard/CommandBoard";

function locationSourceLabel(source: string | null | undefined): string {
  if (source === "ip") {
    return "IP";
  }
  if (source === "browser") {
    return "Browser";
  }
  if (source === "manual") {
    return "Manual";
  }
  return "Manual";
}

/** Type B site desk — control room for one physical installation. */
export function SiteDesk() {
  const { siteId } = useParams();
  return (
    <section className="page cc-page site-desk">
      <LiveGate emptyLayout="command">
        {(org) =>
          siteId ? (
            <DeskBody
              organizationId={org.organizationId}
              siteId={siteId as Id<"sites">}
              permissions={org.permissions}
            />
          ) : (
            <EmptyState title="Missing site" action={<Link to="/sites">Sites</Link>} />
          )
        }
      </LiveGate>
    </section>
  );
}

function DeskBody({
  organizationId,
  siteId,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  permissions: readonly string[];
}) {
  const orgId = id<"organizations">(organizationId);
  const site = useQuery(api.sites.get, {
    organizationId: orgId,
    siteId,
  });
  const devices = useQuery(api.devices.list, {
    organizationId: orgId,
    siteId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const telemetry = useQuery(api.telemetry.currentForSite, {
    organizationId: orgId,
    siteId,
  });
  const setLocation = useMutation(api.sites.setLocation);
  const [locationPending, setLocationPending] = useState(false);
  const canManageLocation = permissions.includes("manage.sites");

  if (site === undefined) {
    return <PageSkeleton rows={6} label="Loading site" />;
  }
  if (site === null) {
    return <EmptyState title="Site not found" action={<Link to="/sites">Sites</Link>} />;
  }
  const gateways = Array.isArray(devices?.page) ? devices.page : [];
  const latestUpdatedAt = Array.isArray(telemetry?.rows)
    ? telemetry.rows.reduce<number | null>((max, row) => {
        const at = row.updatedAt;
        if (at == null || !Number.isFinite(at)) {
          return max;
        }
        return max == null || at > max ? at : max;
      }, null)
    : null;
  const freshness = storedFreshness(latestUpdatedAt, Date.now());
  const updatedAtLabel =
    latestUpdatedAt == null
      ? "No telemetry yet"
      : new Date(latestUpdatedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "medium",
        });

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="crumb-row meta">
            <Link to="/app">Command Center</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/sites">Sites</Link>
            <span aria-hidden="true"> / </span>
            <span>{site.name}</span>
          </p>
          <h1>{site.name}</h1>
          <p className="meta">
            {site.code ? <span className="tech">{site.code}</span> : null}
            {site.region ? (
              <span>
                {site.code ? " · " : ""}
                {site.region}
              </span>
            ) : null}
            {" · "}
            <Link to={siteAlarmsPath(site.siteId)}>Alarms</Link>
            {" · "}
            <Link to={siteEventsPath(site.siteId)}>Events</Link>
            {" · "}
            <Link to={siteTrendsPath(site.siteId)}>Trends</Link>
            {" · "}
            <Link to={siteMaintenancePath(site.siteId)}>Maintenance</Link>
          </p>
          <p className="meta status-row">
            {freshness.stale ? <StatusMark tone="warn">stale</StatusMark> : null}
            <span>
              Last updated {updatedAtLabel}
              {latestUpdatedAt != null ? ` · ${freshness.label}` : ""}
            </span>
          </p>
        </div>
      </header>

      <section className="ops-section" aria-labelledby="site-gateway-title">
        <h2 id="site-gateway-title">Gateway</h2>
        {devices === undefined ? (
          <PageSkeleton rows={2} label="Loading gateways" />
        ) : gateways.length === 0 ? (
          <p className="empty">No gateway linked to this site.</p>
        ) : (
          <ul className="stack">
            {gateways.map((device: { _id: string; name: string; identity: string }) => (
              <li key={device._id}>
                <Link to={siteGatewayPath(site.siteId, device.identity || device._id)}>
                  {device.name}
                </Link>
                <span className="meta tech"> · {device.identity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManageLocation ? (
        <>
          <SiteLocationPicker
            latitude={site.latitude}
            longitude={site.longitude}
            pending={locationPending}
            onSave={async (latitude, longitude) => {
              setLocationPending(true);
              try {
                await setLocation({
                  organizationId: orgId,
                  siteId,
                  latitude,
                  longitude,
                  source: "manual",
                });
              } finally {
                setLocationPending(false);
              }
            }}
          />
          {site.latitude != null && site.longitude != null ? (
            <p className="meta">Source: {locationSourceLabel(site.locationSource)}</p>
          ) : null}
        </>
      ) : site.latitude != null && site.longitude != null ? (
        <p className="meta">
          Location: {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
          {` · ${locationSourceLabel(site.locationSource)}`}
          {site.locationUpdatedAt != null
            ? ` · updated ${new Date(site.locationUpdatedAt).toLocaleString()}`
            : ""}
        </p>
      ) : (
        <p className="meta">No coordinates saved for this site.</p>
      )}

      <FleetBoundary>
        <QueryErrorBoundary title="Site board unavailable">
          <CommandBoard
            organizationId={organizationId}
            siteId={site.siteId}
            siteName={site.name}
            permissions={permissions}
          />
        </QueryErrorBoundary>
      </FleetBoundary>
    </div>
  );
}
