import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { DataTable } from "../../ui/DataTable";
import { Skeleton } from "../../ui/Skeleton";
import { SiteAlarmPanel } from "../../fleet/AlarmPanel";

export function EventsSection({
  organizationId,
  siteId,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites"> | null;
  permissions: readonly string[];
}) {
  return (
    <div className="cc-events-stack">
      {siteId ? (
        <SiteAlarmPanel
          organizationId={organizationId}
          siteId={siteId}
          permissions={permissions}
        />
      ) : (
        <section className="ops-section" aria-labelledby="cc-alarms-empty">
          <h2 id="cc-alarms-empty">Alarms</h2>
          <p className="empty">
            Select a site. <Link to="/alarms">Alarm desk</Link>
          </p>
        </section>
      )}
      {siteId ? (
        <RecentActivitySection organizationId={organizationId} siteId={siteId} />
      ) : (
        <section className="ops-section" aria-labelledby="cc-events-empty">
          <h2 id="cc-events-empty">Events</h2>
          <p className="empty">
            Select a site. <Link to="/events">All events</Link>
          </p>
        </section>
      )}
    </div>
  );
}

function RecentActivitySection({
  organizationId,
  siteId,
}: {
  organizationId: string;
  siteId: Id<"sites">;
}) {
  const data = useQuery(api.deviceHealth.recentForSite, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  if (data === undefined) {
    return <Skeleton lines={4} />;
  }
  return (
    <section className="ops-section" aria-labelledby="cc-recent-events">
      <div className="ops-section-head">
        <h2 id="cc-recent-events">Recent events</h2>
        <Link to="/events">All events</Link>
      </div>
      <DataTable
        dense
        caption="Health transitions"
        rows={data.rows}
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
              <Link to={`/gateways/${row.deviceIdentity ?? row.deviceId}`}>{row.deviceName}</Link>
            ),
          },
          { key: "reason", header: "Reason", render: (row) => row.reason },
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
    </section>
  );
}
