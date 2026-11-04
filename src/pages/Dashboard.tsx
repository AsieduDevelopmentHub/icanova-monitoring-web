import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { SiteRosterGrid } from "../sites/SiteRosterGrid";
import { EmptyState } from "../ui/EmptyState";
import { QueryErrorBoundary } from "../ui/QueryErrorBoundary";
import { Skeleton } from "../ui/Skeleton";
import type { SiteRosterRow } from "../sites/siteRosterView";
import { RegionStats } from "./dashboard/RegionStats";

/** Fleet Command Center — overview that drills into sites. */
export function Dashboard() {
  return (
    <section className="page cc-page">
      {/* Title lives in the shell topbar — avoid a second page header. */}
      <LiveGate emptyLayout="command">
        {(org) => <CommandCenter organizationId={org.organizationId} />}
      </LiveGate>
    </section>
  );
}

function CommandCenter({ organizationId }: { organizationId: string }) {
  const orgId = id<"organizations">(organizationId);
  const roster = useQuery(api.telemetry.siteRoster, { organizationId: orgId });

  return (
    <div className="stack cc-layout">
      <QueryErrorBoundary title="Regional statistics unavailable">
        <RegionStats organizationId={orgId} />
      </QueryErrorBoundary>

      {roster === undefined ? (
        <Skeleton lines={8} />
      ) : roster.length === 0 ? (
        <EmptyState title="No sites" body="Provision a site from Sites." action={<Link to="/sites">Sites</Link>} />
      ) : (
        <section className="cc-sites-section" aria-label="Sites">
          <header className="cc-section-head">
            <h2 className="cc-section-title">Sites</h2>
            <Link to="/sites" className="meta">
              Manage
            </Link>
          </header>
          <SiteRosterGrid rows={roster as SiteRosterRow[]} caption="Fleet sites" />
        </section>
      )}
    </div>
  );
}
