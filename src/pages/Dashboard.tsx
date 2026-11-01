import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { CommandBoard } from "./dashboard/CommandBoard";

/** Command Center — normal-user fleet operations dashboard. */
export function Dashboard() {
  return (
    <section className="page cc-page">
      <h1 className="sr-only">Command Center</h1>
      <LiveGate>
        {(org) => (
          <SiteSelect organizationId={org.organizationId} allowAll>
            {(siteId, siteName) => (
              <FleetBoundary key={siteId ?? "all"}>
                <CommandBoard
                  organizationId={org.organizationId}
                  siteId={siteId}
                  siteName={siteName}
                  permissions={org.permissions}
                />
              </FleetBoundary>
            )}
          </SiteSelect>
        )}
      </LiveGate>
    </section>
  );
}
