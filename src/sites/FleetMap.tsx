import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { hasCoordinates, siteStatus, type SiteHealthFields } from "./siteStatus";

export type FleetMapSite = SiteHealthFields & {
  siteId: string;
  name: string;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
};

const FALLBACK_CENTER: L.LatLngExpression = [5.6037, -0.187];
const FALLBACK_ZOOM = 6;

function markerIcon(tone: string): L.DivIcon {
  return L.divIcon({
    className: `fleet-map-marker tone-${tone}`,
    html: `<span class="fleet-map-dot" aria-hidden="true"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

type Props = {
  sites: readonly FleetMapSite[];
};

/** Leaflet fleet map — only plots sites with real WGS84 coordinates. */
export function FleetMap({ sites }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<L.Map | null>(null);
  const layerObj = useRef<L.LayerGroup | null>(null);

  const placed = useMemo(() => sites.filter(hasCoordinates), [sites]);
  const unplaced = useMemo(() => sites.filter((row) => !hasCoordinates(row)), [sites]);
  const pinKey = useMemo(
    () =>
      placed
        .map((row) => {
          const { tone } = siteStatus(row);
          return `${row.siteId}:${row.latitude}:${row.longitude}:${tone}`;
        })
        .join("|"),
    [placed],
  );

  useEffect(() => {
    if (!mapRef.current || mapObj.current) {
      return;
    }
    const map = L.map(mapRef.current, {
      scrollWheelZoom: true,
      // Fade leaves popups stuck at opacity:0 under some zoom/fitBounds races.
      fadeAnimation: false,
    }).setView(FALLBACK_CENTER, FALLBACK_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerObj.current = L.layerGroup().addTo(map);
    mapObj.current = map;
    const resize = window.setTimeout(() => map.invalidateSize(), 50);
    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapObj.current = null;
      layerObj.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapObj.current;
    const layer = layerObj.current;
    if (!map || !layer) {
      return;
    }
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    for (const row of placed) {
      const { tone, label } = siteStatus(row);
      const marker = L.marker([row.latitude, row.longitude], {
        icon: markerIcon(tone),
        keyboard: true,
        riseOnHover: true,
      });
      const code = row.code ? ` · ${row.code}` : "";
      marker.bindPopup(
        `<div class="fleet-map-popup">
          <strong>${escapeHtml(row.name)}</strong>${escapeHtml(code)}
          <div class="meta">${escapeHtml(label)}</div>
          <a href="/sites/${row.siteId}">Open site</a>
        </div>`,
        { maxWidth: 280, autoPan: true, closeButton: true, className: "fleet-map-popup-wrap" },
      );
      marker.on("click", () => {
        marker.openPopup();
      });
      marker.addTo(layer);
      bounds.push([row.latitude, row.longitude]);
    }
    if (bounds.length === 1) {
      map.setView(bounds[0]!, 12);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 12 });
    } else {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
    }
    const resize = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(resize);
  }, [pinKey, placed]);

  return (
    <div className="fleet-map">
      <div ref={mapRef} className="fleet-map-stage site-map" role="img" aria-label="Sites on map" />
      <p className="meta">
        {placed.length} placed
        {unplaced.length > 0 ? ` · ${unplaced.length} unplaced` : ""}
      </p>
      {unplaced.length > 0 ? (
        <section className="fleet-map-unplaced" aria-label="Sites without coordinates">
          <header className="ops-section-head">
            <h2>Unplaced</h2>
            <span className="meta">{unplaced.length}</span>
          </header>
          <ul className="fleet-map-unplaced-list">
            {unplaced.map((row) => (
              <li key={row.siteId}>
                <Link to={`/sites/${row.siteId}`}>{row.name}</Link>
                {row.code ? <span className="meta tech"> · {row.code}</span> : null}
                <span className="meta"> — set location on site desk</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sites.length > 0 && placed.length === 0 ? (
        <p className="meta">No sites in this filter have coordinates. Open a site desk to set location.</p>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
