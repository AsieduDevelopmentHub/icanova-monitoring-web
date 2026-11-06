import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProvisionSiteDialog } from "../admin/ProvisionSiteDialog";
import { id } from "../fleet/access";
import { LiveGate } from "../fleet/scope";
import { SiteRosterExplorer } from "../sites/SiteRosterExplorer";
import type { SiteRosterRow } from "../sites/siteRosterView";
import { Skeleton } from "../ui/Skeleton";

/** Type A fleet list — sites with provision workflow and map view. */
export function Sites() {
  return (
    <section className="page ops-page sites-page">
      {/* Title lives in the shell topbar — avoid a second page header. */}
      <LiveGate
        emptyLayout="list"
        emptyCaption="Sites"
        emptyColumns={[
          "Site ID",
          "Site Name",
          "Last Updated",
          "Power Source",
          "Battery",
          "Fuel %",
          "HRM (h)",
          "Gateway ID",
          "Region",
          "Gens",
        ]}
      >
        {(org) => (
          <SiteList
            organizationId={org.organizationId}
            permissions={org.permissions}
            siteCodeFormat={
              "siteCodeFormat" in org && (org.siteCodeFormat === "numeric" || org.siteCodeFormat === "text")
                ? org.siteCodeFormat
                : "text"
            }
          />
        )}
      </LiveGate>
    </section>
  );
}

function SiteList({
  organizationId,
  permissions,
  siteCodeFormat,
}: {
  organizationId: string;
  permissions: readonly string[];
  siteCodeFormat: "numeric" | "text";
}) {
  const roster = useQuery(api.telemetry.siteRoster, {
    organizationId: id<"organizations">(organizationId),
  });
  const [open, setOpen] = useState(false);
  const canManage = permissions.includes("manage.sites") && permissions.includes("manage.devices");

  if (roster === undefined) {
    return <Skeleton lines={8} />;
  }

  const rows = roster as SiteRosterRow[];

  return (
    <div className="stack sites-stack">
      <SiteRosterExplorer
        rows={rows}
        caption="Sites"
        allowMap
        actions={canManage ? (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              Provision site
            </button>
            <ProvisionSiteDialog
              open={open}
              organizationId={id<"organizations">(organizationId)}
              siteCodeFormat={siteCodeFormat}
              onClose={() => setOpen(false)}
            />
          </>
        ) : null}
      />
    </div>
  );
}
