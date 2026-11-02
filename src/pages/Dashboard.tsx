import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { id } from "../fleet/access";
import { QueryErrorBoundary } from "../ui/QueryErrorBoundary";
import { CommandBoard } from "./dashboard/CommandBoard";
import { RegionStats } from "./dashboard/RegionStats";

/** Command Center — regional stats by default, ops board below. */
export function Dashboard() {
  return (
    <section className="page cc-page">
      <h1 className="sr-only">Command Center</h1>
      <LiveGate emptyLayout="command">
        {(org) => (
          <div className="stack">
            <QueryErrorBoundary title="Regional statistics unavailable">
              <RegionStats organizationId={id<"organizations">(org.organizationId)} />
            </QueryErrorBoundary>
            <SiteSelect organizationId={org.organizationId} allowAll>
              {(siteId, siteName) => (
                <FleetBoundary key={siteId ?? "all"}>
                  <QueryErrorBoundary title="Operations board unavailable">
                    <CommandBoard
                      organizationId={org.organizationId}
                      siteId={siteId}
                      siteName={siteName}
                      permissions={org.permissions}
                    />
                  </QueryErrorBoundary>
                </FleetBoundary>
              )}
            </SiteSelect>
          </div>
        )}
      </LiveGate>
    </section>
  );
}
