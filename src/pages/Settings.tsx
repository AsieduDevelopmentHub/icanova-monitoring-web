import { Link } from "react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { FirmwareReleasesPanel } from "../admin/FirmwareReleasesPanel";
import { ChangePasswordForm } from "../auth/ChangePasswordForm";
import { accessMessage, id } from "../fleet/access";
import { unsignedNotice } from "../fleet/sessionGates";
import { EmptyState } from "../ui/EmptyState";
import { Dialog } from "../ui/Overlay";
import { Skeleton } from "../ui/Skeleton";

export function Settings() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const configured = Boolean(import.meta.env.VITE_CONVEX_URL);
  const unsigned = unsignedNotice("Deployment settings stay on the server.");
  const orgs = useQuery(api.organizations.mine, isAuthenticated ? {} : "skip");
  const org = Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : null;
  const canManageFirmware = Boolean(org?.permissions?.includes("manage.devices"));
  const canManageSites = Boolean(org?.permissions?.includes("manage.sites"));
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <section className="page ops-page">
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
        <div className="stack">
          <div className="ops-toolbar">
            <button type="button" className="btn btn-secondary" onClick={() => setPasswordOpen(true)}>
              Change password
            </button>
            <Link className="btn btn-secondary" to="/local/configure">
              Configure gateway
            </Link>
            <Link className="btn btn-secondary" to="/sites">
              Sites
            </Link>
          </div>
          <Dialog open={passwordOpen} title="Change password" onClose={() => setPasswordOpen(false)}>
            <ChangePasswordForm />
          </Dialog>
        </div>
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

      {configured && isAuthenticated && org ? (
        <section className="ops-section" aria-labelledby="settings-firmware-title">
          <h2 id="settings-firmware-title">Firmware</h2>
          <FirmwareReleasesPanel
            organizationId={id<"organizations">(org.organizationId)}
            canManage={canManageFirmware}
          />
        </section>
      ) : null}

      <section className="ops-section" aria-labelledby="settings-retention-title">
        <h2 id="settings-retention-title">Retention</h2>
        <p className="meta">
          Telemetry ~7d · health ~14d · <Link to="/notifications">Notifications</Link>
        </p>
      </section>
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
      setMessage("Site ID format updated.");
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
      setMessage(`Backfilled ${result.updated} site ID(s).`);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ops-section" aria-labelledby="settings-site-ids-title">
      <h2 id="settings-site-ids-title">Site IDs</h2>
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
            Backfill missing IDs
          </button>
        ) : (
          <span className="meta">Read only</span>
        )}
      </div>
      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="meta">{message}</p> : null}
    </section>
  );
}
