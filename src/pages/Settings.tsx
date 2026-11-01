import { Link } from "react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FirmwareReleasesPanel } from "../admin/FirmwareReleasesPanel";
import { ChangePasswordForm } from "../auth/ChangePasswordForm";
import { id } from "../fleet/access";
import { unsignedNotice } from "../fleet/sessionGates";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";

export function Settings() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const configured = Boolean(import.meta.env.VITE_CONVEX_URL);
  const unsigned = unsignedNotice("Deployment settings stay on the server.");
  const orgs = useQuery(api.organizations.mine, isAuthenticated ? {} : "skip");
  const org = Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : null;
  const canManageFirmware = Boolean(org?.permissions?.includes("manage.devices"));

  return (
    <section className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      {!configured ? (
        <EmptyState
          title="Convex is not configured"
          body="Live settings queries are not running until VITE_CONVEX_URL is set."
        />
      ) : isLoading ? (
        <Skeleton lines={4} />
      ) : !isAuthenticated ? (
        <div className="notice" role="note">
          <strong>{unsigned.title}</strong> {unsigned.detail}
        </div>
      ) : (
        <Panel title="Change password">
          <ChangePasswordForm />
        </Panel>
      )}

      <Panel title="Gateway">
        <p className="meta">
          Soft-AP Modbus and Wi-Fi stay on the device — <Link to="/local/configure">Configure</Link>.
        </p>
      </Panel>

      {configured && isAuthenticated && org ? (
        <Panel title="Firmware releases">
          <p className="meta">
            Publish ESP32-C3 builds for cloud OTA. Devices check{" "}
            <span className="tech">/ncu/ota/check</span> with their ingest bearer.
          </p>
          <FirmwareReleasesPanel
            organizationId={id<"organizations">(org.organizationId)}
            canManage={canManageFirmware}
          />
        </Panel>
      ) : null}

      <Panel title="Retention">
        <p className="meta">
          Telemetry buckets ~7 days · health events ~14 days. Channels:{" "}
          <Link to="/notifications">Notifications</Link>.
        </p>
      </Panel>
    </section>
  );
}
