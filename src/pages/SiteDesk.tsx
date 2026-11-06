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
      <header className="page-identity site-detail-header">
        <div className="page-identity-main">
          <h1 className="page-identity-title">{site.name}</h1>
          <div className="site-detail-meta">
            {site.code ? <span className="tech">{site.code}</span> : null}
            {site.region ? <span>{site.region}</span> : null}
          </div>
          <p className="meta site-detail-freshness">
            {freshness.stale ? <StatusMark tone="warn">stale</StatusMark> : null}
            <span>
              Last updated {updatedAtLabel}
              {latestUpdatedAt != null ? ` · ${freshness.label}` : ""}
            </span>
          </p>
        </div>
        <nav className="site-detail-actions" aria-label="Site shortcuts">
          <Link className="btn btn-secondary" to={siteAlarmsPath(site.siteId)}>Alarms</Link>
          <Link className="btn btn-secondary" to={siteEventsPath(site.siteId)}>Events</Link>
          <Link className="btn btn-secondary" to={siteTrendsPath(site.siteId)}>Trends</Link>
          <Link className="btn btn-secondary" to={siteMaintenancePath(site.siteId)}>Maintenance</Link>
        </nav>
      </header>

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

      <div className="site-context-grid">
        <section className="ops-section site-context-panel" aria-labelledby="site-gateway-title">
          <div className="ops-section-head">
            <h2 id="site-gateway-title">Gateways</h2>
            {devices?.isDone === false ? <span className="meta">First 20 shown</span> : null}
          </div>
          {devices === undefined ? (
            <PageSkeleton rows={2} label="Loading gateways" />
          ) : gateways.length === 0 ? (
            <p className="empty">No gateway linked to this site.</p>
          ) : (
            <>
              <ul className="site-gateway-list">
                {gateways.map((device: { _id: string; name: string; identity: string }) => (
                  <li key={device._id}>
                    <Link to={siteGatewayPath(site.siteId, device.identity || device._id)}>
                      <span>{device.name}</span>
                      <span className="meta tech">{device.identity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {devices.isDone === false ? (
                <p className="meta">Additional gateways are not shown on this site page.</p>
              ) : null}
            </>
          )}
        </section>

        {canManageLocation ? (
          <div className="site-location-context">
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
              <p className="meta site-location-source">Source: {locationSourceLabel(site.locationSource)}</p>
            ) : null}
          </div>
        ) : (
          <section className="ops-section site-context-panel" aria-labelledby="site-location-title">
            <h2 id="site-location-title">Location</h2>
            {site.latitude != null && site.longitude != null ? (
              <dl className="facts site-location-facts">
                <dt>Coordinates</dt>
                <dd className="tech">{site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}</dd>
                <dt>Source</dt>
                <dd>{locationSourceLabel(site.locationSource)}</dd>
                {site.locationUpdatedAt != null ? (
                  <>
                    <dt>Updated</dt>
                    <dd>{new Date(site.locationUpdatedAt).toLocaleString()}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="empty">No coordinates saved for this site.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
