import { Link } from "react-router";
import { useConvexAuth } from "convex/react";
import { unsignedNotice } from "../fleet/sessionGates";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";

export function Settings() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const configured = Boolean(import.meta.env.VITE_CONVEX_URL);
  const unsigned = unsignedNotice("Deployment settings stay on the server.");

  return (
    <section className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <p>
          Read-only deployment notes. This screen does not change ESP32 poll intervals, Soft-AP Wi-Fi,
          or uplink secrets.
        </p>
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
      ) : null}

      <Panel title="What stays on the gateway" description="Local Soft-AP / USB CLI configuration is not delivered from the cloud.">
        <p className="meta">
          Browser preferences do not change ESP32 poll interval or uplink period. Those stay on the
          device.
        </p>
        <p className="meta">
          Soft-AP Modbus baud, parity, and GenComm writes are applied locally — see{" "}
          <Link to="/local/configure">Configure</Link>.
        </p>
      </Panel>

      <Panel title="Retention & notifications" description="Honest limits of the current deployment.">
        <p className="meta">
          Historical telemetry buckets prune after about seven days. Current telemetry is one document
          per generator and is not part of that prune. Health events retain about fourteen days.
        </p>
        <p className="meta">
          Resend and Arkesel credentials are Convex environment variables. Browser push uses optional
          VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) — never FCM. Without
          VAPID env, push policies record not configured.
        </p>
        <p className="meta">
          Configure personal channels under <Link to="/notifications">Notifications</Link>. Role,
          export, and notification changes are audited.
        </p>
      </Panel>
    </section>
  );
}
