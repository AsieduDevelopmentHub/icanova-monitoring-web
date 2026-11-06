import { useMemo, useState, type ReactNode } from "react";
import { FleetMap } from "./FleetMap";
import { SiteRosterGrid } from "./SiteRosterGrid";
import {
  powerSourceLabel,
  siteLastActivityAt,
  type SiteRosterRow,
} from "./siteRosterView";
import { siteLiveState } from "./siteStatus";
import { Dialog } from "../ui/Overlay";
import { Icon } from "../ui/icons";
import { useLiveNow } from "../ui/useLiveNow";
import { FilterMultiSelect, FilterSelect } from "../ui/FilterBar";

type SiteRosterSort =
  | "updated-desc"
  | "updated-asc"
  | "name-asc"
  | "name-desc"
  | "fuel-asc"
  | "fuel-desc";

const DEFAULT_SORT: SiteRosterSort = "updated-desc";
const POWER_SOURCE_OPTIONS = [
  { value: "generator", label: "Generator" },
  { value: "mains", label: "Mains" },
  { value: "stopped", label: "Stopped" },
  { value: "gateway", label: "Gateway only" },
  { value: "unknown", label: "Unknown / telemetry only" },
];
const UPDATE_OPTIONS = [
  { value: "updating", label: "Updating" },
  { value: "not-updating", label: "Not updating" },
  { value: "no-activity", label: "No recorded activity" },
];
const SITE_STATE_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "attention", label: "Needs attention" },
];
const SORT_OPTIONS = [
  { value: "updated-desc", label: "Updated · newest first" },
  { value: "updated-asc", label: "Updated · oldest first" },
  { value: "name-asc", label: "Site name · A to Z" },
  { value: "name-desc", label: "Site name · Z to A" },
  { value: "fuel-asc", label: "Fuel · lowest first" },
  { value: "fuel-desc", label: "Fuel · highest first" },
];

function measured(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function SiteRosterExplorer({
  rows,
  caption = "Sites",
  allowMap = false,
  actions,
}: {
  rows: readonly SiteRosterRow[];
  caption?: string;
  allowMap?: boolean;
  actions?: ReactNode;
}) {
  const now = useLiveNow(5_000);
  const [query, setQuery] = useState("");
  const [regionsSelected, setRegionsSelected] = useState<string[]>([]);
  const [powerSourcesSelected, setPowerSourcesSelected] = useState<string[]>([]);
  const [fuelBelow, setFuelBelow] = useState("");
  const [updateStatesSelected, setUpdateStatesSelected] = useState<string[]>([]);
  const [siteStatesSelected, setSiteStatesSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<SiteRosterSort>(DEFAULT_SORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapView, setMapView] = useState(false);

  const regions = useMemo(
    () => [...new Set(rows.map((row) => row.region).filter((value): value is string => Boolean(value)))].sort(),
    [rows],
  );
  const activeFilters =
    Number(query.trim().length > 0) +
    Number(regionsSelected.length > 0) +
    Number(powerSourcesSelected.length > 0) +
    Number(fuelBelow !== "") +
    Number(updateStatesSelected.length > 0) +
    Number(siteStatesSelected.length > 0) +
    Number(sort !== DEFAULT_SORT);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const parsedFuel = fuelBelow === "" ? null : Number(fuelBelow);
    const maxFuel =
      parsedFuel !== null && Number.isFinite(parsedFuel) && parsedFuel >= 0 && parsedFuel <= 100
        ? parsedFuel
        : null;
    return rows
      .filter((row) => {
        if (
          search &&
          !`${row.name} ${row.code ?? ""} ${row.region ?? ""} ${row.gatewayId ?? ""} ${row.gatewayName ?? ""}`
            .toLowerCase()
            .includes(search)
        ) {
          return false;
        }
        if (regionsSelected.length > 0 && !regionsSelected.includes(row.region ?? "")) {
          return false;
        }
        if (powerSourcesSelected.length > 0) {
          const source = powerSourceLabel(row);
          const matchingSources = powerSourcesSelected.some(
            (powerSource) =>
              (powerSource === "generator" && source.startsWith("Generator")) ||
              (powerSource === "mains" && source.startsWith("Mains")) ||
              (powerSource === "stopped" && source.startsWith("Stopped")) ||
              (powerSource === "gateway" && source.startsWith("Gateway")) ||
              (powerSource === "unknown" && (source === "—" || source === "Telemetry")),
          );
          if (!matchingSources) {
            return false;
          }
        }
        if (maxFuel !== null && (!measured(row.primaryFuelPct) || row.primaryFuelPct >= maxFuel)) {
          return false;
        }
        if (updateStatesSelected.length > 0) {
          const activity = siteLastActivityAt(row);
          const isUpdating = siteLiveState(row, now).label === "Updating";
          const matchingUpdateState = updateStatesSelected.some(
            (updateState) =>
              (updateState === "updating" && isUpdating) ||
              (updateState === "not-updating" && activity !== null && !isUpdating) ||
              (updateState === "no-activity" && activity === null),
          );
          if (!matchingUpdateState) {
            return false;
          }
        }
        if (siteStatesSelected.length > 0) {
          const needsAttention =
            row.overallUnhealthy > 0 ||
            row.gatewayOffline > 0 ||
            row.linkFail > 0 ||
            row.activeCommProblems > 0;
          const isOperational = row.reporting > 0 || row.gatewayOnline > 0;
          const matchesSelectedSiteState = siteStatesSelected.some(
            (state) =>
              (state === "attention" && needsAttention) ||
              (state === "operational" && isOperational),
          );
          if (!matchesSelectedSiteState) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "name-asc" || sort === "name-desc") {
          const order = a.name.localeCompare(b.name);
          return sort === "name-asc" ? order : -order;
        }
        if (sort === "fuel-asc" || sort === "fuel-desc") {
          if (!measured(a.primaryFuelPct) || !measured(b.primaryFuelPct)) {
            if (measured(a.primaryFuelPct) !== measured(b.primaryFuelPct)) {
              return measured(a.primaryFuelPct) ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          }
          const fuelOrder =
            sort === "fuel-asc"
              ? a.primaryFuelPct - b.primaryFuelPct
              : b.primaryFuelPct - a.primaryFuelPct;
          return fuelOrder || a.name.localeCompare(b.name);
        }
        const aAt = siteLastActivityAt(a);
        const bAt = siteLastActivityAt(b);
        if (aAt === null || bAt === null) {
          if (aAt !== bAt) {
            return aAt === null ? 1 : -1;
          }
          return a.name.localeCompare(b.name);
        }
        const order = sort === "updated-desc" ? bAt - aAt : aAt - bAt;
        return order || a.name.localeCompare(b.name);
      });
  }, [
    rows,
    query,
    regionsSelected,
    powerSourcesSelected,
    fuelBelow,
    updateStatesSelected,
    siteStatesSelected,
    sort,
    now,
  ]);

  function clearFilters() {
    setQuery("");
    setRegionsSelected([]);
    setPowerSourcesSelected([]);
    setFuelBelow("");
    setUpdateStatesSelected([]);
    setSiteStatesSelected([]);
    setSort(DEFAULT_SORT);
  }

  const attentionCount = rows.filter(
    (row) => row.overallUnhealthy > 0 || row.gatewayOffline > 0,
  ).length;

  return (
    <section className="site-roster-explorer" aria-label={caption}>
      <header className="site-roster-explorer-toolbar">
        <p className="meta site-roster-explorer-count" aria-live="polite">
          {rows.length} sites · {filtered.length} shown
          {attentionCount > 0 ? ` · ${attentionCount} attention` : ""}
        </p>
        <div className="site-roster-explorer-actions">
          {actions}
          {allowMap ? (
            <div className="sites-view-toggle" role="group" aria-label="Sites view">
              <button
                type="button"
                className={!mapView ? "is-active" : undefined}
                aria-pressed={!mapView}
                onClick={() => setMapView(false)}
              >
                List
              </button>
              <button
                type="button"
                className={mapView ? "is-active" : undefined}
                aria-pressed={mapView}
                onClick={() => setMapView(true)}
              >
                Map
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary site-roster-filter-trigger"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <Icon name="search" />
            <span>Filter & search</span>
            {activeFilters > 0 ? <span className="site-roster-filter-count">{activeFilters}</span> : null}
          </button>
        </div>
      </header>
      <Dialog open={filtersOpen} title="Filter and search sites" onClose={() => setFiltersOpen(false)}>
        <div className="site-roster-filter-panel" role="search" aria-label="Site filters">
          <label className="filter-field">
            <span>Search sites</span>
            <input
              type="search"
              value={query}
              placeholder="Name, code, gateway, or region"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <FilterMultiSelect
            label="Region"
            allLabel="All regions"
            values={regionsSelected}
            onChange={setRegionsSelected}
            options={regions.map((name) => ({ value: name, label: name }))}
          />
          <FilterMultiSelect
            label="Power source"
            allLabel="All sources"
            values={powerSourcesSelected}
            onChange={setPowerSourcesSelected}
            options={POWER_SOURCE_OPTIONS}
          />
          <label className="filter-field">
            <span>Fuel below (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="decimal"
              value={fuelBelow}
              aria-invalid={fuelBelow !== "" && (Number(fuelBelow) < 0 || Number(fuelBelow) > 100)}
              onChange={(event) => setFuelBelow(event.target.value)}
              placeholder="Any fuel level"
            />
            {fuelBelow !== "" && (Number(fuelBelow) < 0 || Number(fuelBelow) > 100) ? (
              <span className="site-roster-filter-error">Enter a value from 0 to 100.</span>
            ) : null}
          </label>
          <FilterMultiSelect
            label="Update status"
            allLabel="All update states"
            values={updateStatesSelected}
            onChange={setUpdateStatesSelected}
            options={UPDATE_OPTIONS}
          />
          <FilterMultiSelect
            label="Site status"
            allLabel="All site states"
            values={siteStatesSelected}
            onChange={setSiteStatesSelected}
            options={SITE_STATE_OPTIONS}
          />
          <FilterSelect
            label="Sort by"
            value={sort}
            onChange={(value) => setSort(value as SiteRosterSort)}
            options={SORT_OPTIONS}
          />
          <div className="site-roster-filter-actions">
            <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>
            <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} sites
            </button>
          </div>
        </div>
      </Dialog>
      {filtered.length === 0 ? (
        <p className="empty site-roster-empty">
          {rows.length === 0 ? "No sites to show." : "No sites match these filters."}
        </p>
      ) : allowMap && mapView ? (
        <FleetMap sites={filtered} />
      ) : (
        <SiteRosterGrid rows={filtered} caption={caption} mobileCards preserveOrder />
      )}
    </section>
  );
}
