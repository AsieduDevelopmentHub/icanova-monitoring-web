import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { DataTable } from "../../ui/DataTable";
import { Panel } from "../../ui/Panel";
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
        <Panel title="Alarms">
          <p className="empty">Select a site to inspect active alarms, or open the alarms desk.</p>
          <p className="meta">
            <Link to="/alarms">Open alarms</Link>
          </p>
        </Panel>
      )}
      {siteId ? (
        <RecentActivitySection organizationId={organizationId} siteId={siteId} />
      ) : (
        <Panel title="Events">
          <p className="empty">Site-scoped health transitions appear when a site is selected.</p>
        </Panel>
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
    <Panel title="Recent events" actions={<Link to="/events">All events</Link>}>
      <DataTable
        dense
        caption="Recent health transitions"
        rows={data.rows}
        getRowKey={(row) => row._id}
        empty="No health transitions stored for this site yet."
        columns={[
          {
            key: "at",
            header: "When",
            render: (row) => (
              <span className="tech">{new Date(row.at).toLocaleString()}</span>
            ),
          },
          {
            key: "device",
            header: "Gateway",
            render: (row) => <Link to={`/gateways/${row.deviceId}`}>{row.deviceName}</Link>,
          },
          { key: "reason", header: "Reason", render: (row) => row.reason },
          {
            key: "change",
            header: "Change",
            render: (row) => {
              const parts = [
                row.gatewayTo ? `gateway → ${row.gatewayTo}` : null,
                row.modbusTo ? `modbus → ${row.modbusTo}` : null,
                row.freshnessTo ? `freshness → ${row.freshnessTo}` : null,
                row.overallTo ? `overall → ${row.overallTo}` : null,
              ].filter(Boolean);
              return parts.length > 0 ? parts.join(" · ") : "—";
            },
          },
        ]}
      />
    </Panel>
  );
}
