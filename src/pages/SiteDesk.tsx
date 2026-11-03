import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import { LiveGate } from "../fleet/scope";
import { EmptyState } from "../ui/EmptyState";
import { QueryErrorBoundary } from "../ui/QueryErrorBoundary";
import { PageSkeleton } from "../ui/Skeleton";
import { CommandBoard } from "./dashboard/CommandBoard";

/** Type B site detail — generators, gateway, telemetry, contextual alarms. */
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
  const site = useQuery(api.sites.get, {
    organizationId: id<"organizations">(organizationId),
    siteId,
  });
  if (site === undefined) {
    return <PageSkeleton rows={6} label="Loading site" />;
  }
  if (site === null) {
    return <EmptyState title="Site not found" action={<Link to="/sites">Sites</Link>} />;
  }
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
            {site.region ? <span>{site.code ? " · " : ""}{site.region}</span> : null}
            {" · "}
            <Link to={`/alarms?site=${site.siteId}`}>Alarms</Link>
            {" · "}
            <Link to={`/events`}>Events</Link>
          </p>
        </div>
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
    </div>
  );
}
