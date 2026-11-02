import { Link } from "react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { FirmwareReleasesPanel } from "../admin/FirmwareReleasesPanel";
import { ChangePasswordForm } from "../auth/ChangePasswordForm";
import { accessMessage, id } from "../fleet/access";
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
  const canManageSites = Boolean(org?.permissions?.includes("manage.sites"));

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

      {configured && isAuthenticated && org ? (
        <SiteCodeFormatPanel
          organizationId={org.organizationId}
          canManage={canManageSites}
          initialFormat={
            "siteCodeFormat" in org && org.siteCodeFormat === "numeric" ? "numeric" : "text"
          }
        />
      ) : null}

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

function SiteCodeFormatPanel({
  organizationId,
  canManage,
  initialFormat,
}: {
  organizationId: string;
  canManage: boolean;
  initialFormat: "numeric" | "text";
}) {
  const settings = useQuery(api.organizations.settings, {
    organizationId: id<"organizations">(organizationId),
  });
  const setFormat = useMutation(api.organizations.setSiteCodeFormat);
  const backfill = useMutation(api.sites.backfillCodes);
  const [format, setLocal] = useState<"numeric" | "text">(initialFormat);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = settings?.siteCodeFormat ?? format;

  async function save(next: "numeric" | "text") {
    if (!canManage || pending) {
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await setFormat({
        organizationId: id<"organizations">(organizationId),
        format: next,
      });
      setLocal(next);
      setMessage("Site code format updated.");
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function runBackfill() {
    if (!canManage || pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await backfill({
        organizationId: id<"organizations">(organizationId),
      });
      setMessage(`Backfilled ${result.updated} site code(s).`);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Site codes">
      <p className="meta">
        Human site codes are shown in the UI instead of internal database ids. Format applies to new
        provisions.
      </p>
      <div className="filter-bar">
        <label className="filter-field">
          <span>Format</span>
          <select
            value={current}
            disabled={!canManage || pending || settings === undefined}
            onChange={(event) => void save(event.target.value === "numeric" ? "numeric" : "text")}
          >
            <option value="text">Text</option>
            <option value="numeric">Numeric only</option>
          </select>
        </label>
        {canManage ? (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => void runBackfill()}>
            Backfill missing codes
          </button>
        ) : (
          <p className="meta">Changing format requires manage.sites.</p>
        )}
      </div>
      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="meta">{message}</p> : null}
    </Panel>
  );
}
