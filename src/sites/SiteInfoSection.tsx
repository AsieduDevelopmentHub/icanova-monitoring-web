import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { id } from "../fleet/access";
import { FilterSelect } from "../ui/FilterBar";
import { useLiveNow } from "../ui/useLiveNow";

type SiteInfoDetails = {
  zone: string;
  cluster: string;
  address: string;
  siteType: string;
  category: string;
  energyClassification: string;
  coolingClassification: string;
  geoClassification: string;
  siteClassification: string;
  simDetails: string;
  customerSiteId: string;
  fieldEngineer: string;
  engineerContact: string;
  communicationMode: string;
  installationAt: number | null;
};

type SiteInfoSite = {
  siteId: Id<"sites">;
  name: string;
  code: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: number | null;
  locationSource: string | null;
  siteInfo: SiteInfoDetails;
  assignedOperatorUserId: Id<"users"> | null;
  assignedOperatorName: string | null;
  assignedOperatorNote: string | null;
  onAirSince: number | null;
};

type Draft = {
  name: string;
  code: string;
  region: string;
  latitude: string;
  longitude: string;
  details: Omit<SiteInfoDetails, "installationAt"> & { installationAt: string };
  assignedOperatorUserId: string;
  assignedOperatorNote: string;
  onAirSince: string;
};

const TEXT_FIELDS: {
  key: keyof SiteInfoDetails;
  label: string;
  maxLength: number;
  multiline?: boolean;
}[] = [
  { key: "zone", label: "Zone", maxLength: 100 },
  { key: "cluster", label: "Cluster", maxLength: 100 },
  { key: "address", label: "Site address", maxLength: 500, multiline: true },
  { key: "siteType", label: "Site type", maxLength: 100 },
  { key: "category", label: "Category", maxLength: 100 },
  { key: "energyClassification", label: "Energy classification", maxLength: 160 },
  { key: "coolingClassification", label: "Cooling classification", maxLength: 160 },
  { key: "geoClassification", label: "Geo classification", maxLength: 160 },
  { key: "siteClassification", label: "Site classification", maxLength: 160 },
  { key: "simDetails", label: "SIM details", maxLength: 500 },
  { key: "customerSiteId", label: "Customer site ID", maxLength: 120 },
  { key: "fieldEngineer", label: "Field engineer", maxLength: 160 },
  { key: "engineerContact", label: "Contact#", maxLength: 120 },
  { key: "communicationMode", label: "Communication mode", maxLength: 100 },
];

function localDateTime(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function dateTimeTimestamp(value: string, label: string): number | null {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }
  return timestamp;
}

function makeDraft(site: SiteInfoSite): Draft {
  return {
    name: site.name,
    code: site.code ?? "",
    region: site.region ?? "",
    latitude: site.latitude == null ? "" : String(site.latitude),
    longitude: site.longitude == null ? "" : String(site.longitude),
    details: {
      ...site.siteInfo,
      installationAt: localDateTime(site.siteInfo.installationAt),
    },
    assignedOperatorUserId: site.assignedOperatorUserId ?? "",
    assignedOperatorNote: site.assignedOperatorNote ?? "",
    onAirSince: localDateTime(site.onAirSince),
  };
}

function optionalCoordinate(value: string, label: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }
  return coordinate;
}

function displayDate(timestamp: number | null): string {
  if (timestamp == null) {
    return "N/A";
  }
  const date = new Date(timestamp);
  return !Number.isFinite(date.getTime())
    ? "N/A"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function dateTimeAttribute(timestamp: number): string | undefined {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function locationSourceLabel(source: string | null): string {
  if (source === "ip") {
    return "IP";
  }
  if (source === "browser") {
    return "Browser";
  }
  return "Manual";
}

function elapsedSince(timestamp: number | null, now: number): string {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return "N/A";
  }
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hr`;
  }
  const days = Math.floor(elapsedHours / 24);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = days - years * 365 - months * 30;
  const parts = [
    years ? `${years} yr` : "",
    months ? `${months} mo` : "",
    remainingDays ? `${remainingDays} d` : "",
  ].filter(Boolean);
  return parts.slice(0, 2).join(" ") || "1 d";
}

function InfoGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="site-info-group" aria-label={title}>
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="site-info-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SiteInfoSection({
  organizationId,
  site,
  canManage,
}: {
  organizationId: Id<"organizations">;
  site: SiteInfoSite;
  canManage: boolean;
}) {
  const now = useLiveNow(60_000);
  const updateInfo = useMutation(api.sites.updateInfo);
  const operatorOptions = useQuery(
    api.sites.operatorOptions,
    canManage ? { organizationId } : "skip",
  );
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => makeDraft(site));

  useEffect(() => {
    if (!editing) {
      setDraft(makeDraft(site));
    }
  }, [editing, site]);

  function setTextField(key: keyof SiteInfoDetails, value: string) {
    if (key === "installationAt") {
      setDraft((current) => ({
        ...current,
        details: { ...current.details, installationAt: value },
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      details: { ...current.details, [key]: value },
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const latitude = optionalCoordinate(draft.latitude, "Latitude");
      const longitude = optionalCoordinate(draft.longitude, "Longitude");
      if ((latitude === null) !== (longitude === null)) {
        throw new Error("Enter both latitude and longitude, or clear both.");
      }
      await updateInfo({
        organizationId,
        siteId: site.siteId,
        name: draft.name,
        code: draft.code,
        region: draft.region,
        latitude,
        longitude,
        details: {
          ...draft.details,
          installationAt: dateTimeTimestamp(draft.details.installationAt, "installation date"),
        },
        assignedOperatorUserId: draft.assignedOperatorUserId
          ? id<"users">(draft.assignedOperatorUserId)
          : null,
        assignedOperatorNote: draft.assignedOperatorNote,
        onAirSince: dateTimeTimestamp(draft.onAirSince, "time on air"),
      });
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save site information.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ops-section site-info-section" aria-labelledby="site-info-title">
      <header className="ops-section-head">
        <div>
          <h2 id="site-info-title">Site Info</h2>
          <p className="meta">Administrative, location, and site-operations details.</p>
        </div>
        {canManage && !editing ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraft(makeDraft(site));
              setError(null);
              setEditing(true);
            }}
          >
            Edit site info
          </button>
        ) : null}
      </header>

      {editing ? (
        <form className="site-info-form" onSubmit={(event) => void save(event)}>
          <div className="site-info-form-grid">
            <label className="filter-field">
              <span>Site name</span>
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="filter-field">
              <span>Site ID</span>
              <input
                required
                maxLength={32}
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              />
            </label>
            <label className="filter-field">
              <span>Region</span>
              <input
                maxLength={120}
                value={draft.region}
                onChange={(event) => setDraft({ ...draft, region: event.target.value })}
              />
            </label>
            {TEXT_FIELDS.map((field) => (
              <label className="filter-field" key={field.key}>
                <span>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    maxLength={field.maxLength}
                    rows={2}
                    value={draft.details[field.key] as string}
                    onChange={(event) => setTextField(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    maxLength={field.maxLength}
                    value={draft.details[field.key] as string}
                    onChange={(event) => setTextField(field.key, event.target.value)}
                  />
                )}
              </label>
            ))}
            <label className="filter-field">
              <span>Installation date</span>
              <input
                type="datetime-local"
                value={draft.details.installationAt}
                onChange={(event) => setTextField("installationAt", event.target.value)}
              />
            </label>
            <label className="filter-field">
              <span>Latitude</span>
              <input
                inputMode="decimal"
                value={draft.latitude}
                onChange={(event) => setDraft({ ...draft, latitude: event.target.value })}
              />
            </label>
            <label className="filter-field">
              <span>Longitude</span>
              <input
                inputMode="decimal"
                value={draft.longitude}
                onChange={(event) => setDraft({ ...draft, longitude: event.target.value })}
              />
            </label>
            <FilterSelect
              label="Assigned operator"
              value={draft.assignedOperatorUserId}
              disabled={operatorOptions === undefined}
              onChange={(assignedOperatorUserId) =>
                setDraft({ ...draft, assignedOperatorUserId })
              }
              options={[
                { value: "", label: "Unassigned" },
                ...(site.assignedOperatorUserId &&
                !operatorOptions?.some((item) => item.userId === site.assignedOperatorUserId)
                  ? [
                      {
                        value: site.assignedOperatorUserId,
                        label: site.assignedOperatorName ?? "Previously assigned operator",
                      },
                    ]
                  : []),
                ...(operatorOptions ?? []).map((operator) => ({
                  value: operator.userId,
                  label: operator.name,
                })),
              ]}
            />
            <label className="filter-field">
              <span>Operator note</span>
              <input
                maxLength={500}
                value={draft.assignedOperatorNote}
                onChange={(event) =>
                  setDraft({ ...draft, assignedOperatorNote: event.target.value })
                }
              />
            </label>
            <label className="filter-field">
              <span>Time on air since</span>
              <input
                type="datetime-local"
                value={draft.onAirSince}
                onChange={(event) => setDraft({ ...draft, onAirSince: event.target.value })}
              />
            </label>
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="site-info-actions">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save site info"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => {
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="site-info-groups">
          <InfoGroup title="Site identity">
            <InfoRow label="Site ID">{site.code || "N/A"}</InfoRow>
            <InfoRow label="Site name">{site.name || "N/A"}</InfoRow>
            <InfoRow label="Zone">{site.siteInfo.zone || "N/A"}</InfoRow>
            <InfoRow label="Region">{site.region || "N/A"}</InfoRow>
            <InfoRow label="Cluster">{site.siteInfo.cluster || "N/A"}</InfoRow>
            <InfoRow label="Site address">{site.siteInfo.address || "N/A"}</InfoRow>
            <InfoRow label="Site type">{site.siteInfo.siteType || "N/A"}</InfoRow>
            <InfoRow label="Category">{site.siteInfo.category || "N/A"}</InfoRow>
          </InfoGroup>
          <InfoGroup title="Classifications">
            <InfoRow label="Energy">{site.siteInfo.energyClassification || "N/A"}</InfoRow>
            <InfoRow label="Cooling">{site.siteInfo.coolingClassification || "N/A"}</InfoRow>
            <InfoRow label="Geo">{site.siteInfo.geoClassification || "N/A"}</InfoRow>
            <InfoRow label="Site">{site.siteInfo.siteClassification || "N/A"}</InfoRow>
          </InfoGroup>
          <InfoGroup title="Site operations">
            <InfoRow label="Assigned operator">{site.assignedOperatorName || "N/A"}</InfoRow>
            <InfoRow label="Operator note">{site.assignedOperatorNote || "N/A"}</InfoRow>
            <InfoRow label="Installation date">
              {displayDate(site.siteInfo.installationAt)}
            </InfoRow>
            <InfoRow label="Time on air">
              {site.onAirSince == null ? (
                "N/A"
              ) : (
                <>
                  <time dateTime={dateTimeAttribute(site.onAirSince)}>
                    {displayDate(site.onAirSince)}
                  </time>
                  <span className="site-info-subvalue">{elapsedSince(site.onAirSince, now)}</span>
                </>
              )}
            </InfoRow>
            <InfoRow label="Field engineer">{site.siteInfo.fieldEngineer || "N/A"}</InfoRow>
            <InfoRow label="Contact#">{site.siteInfo.engineerContact || "N/A"}</InfoRow>
          </InfoGroup>
          <InfoGroup title="Connectivity and coordinates">
            <InfoRow label="SIM details">{site.siteInfo.simDetails || "N/A"}</InfoRow>
            <InfoRow label="Customer site ID">{site.siteInfo.customerSiteId || "N/A"}</InfoRow>
            <InfoRow label="Communication mode">
              {site.siteInfo.communicationMode || "N/A"}
            </InfoRow>
            <InfoRow label="Latitude">
              {site.latitude == null ? "N/A" : site.latitude.toFixed(6)}
            </InfoRow>
            <InfoRow label="Longitude">
              {site.longitude == null ? "N/A" : site.longitude.toFixed(6)}
            </InfoRow>
            <InfoRow label="Map">
              {site.latitude != null && site.longitude != null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}#map=15/${site.latitude}/${site.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open site location
                </a>
              ) : (
                "N/A"
              )}
            </InfoRow>
            {site.locationUpdatedAt != null ? (
              <InfoRow label="Coordinates updated">
                {displayDate(site.locationUpdatedAt)} · {locationSourceLabel(site.locationSource)}
              </InfoRow>
            ) : null}
          </InfoGroup>
        </div>
      )}
    </section>
  );
}
