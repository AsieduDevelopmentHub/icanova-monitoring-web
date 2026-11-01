import { useEffect, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type Props = {
  latitude: number | null;
  longitude: number | null;
  disabled?: boolean;
  pending?: boolean;
  onSave: (latitude: number, longitude: number) => Promise<void>;
};

export function SiteLocationPicker({
  latitude,
  longitude,
  disabled,
  pending,
  onSave,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markerObj = useRef<L.Marker | null>(null);
  const disabledRef = useRef(disabled);
  const [lat, setLat] = useState(latitude != null ? String(latitude) : "");
  const [lon, setLon] = useState(longitude != null ? String(longitude) : "");
  const [error, setError] = useState<string | null>(null);

  disabledRef.current = disabled;

  useEffect(() => {
    setLat(latitude != null ? String(latitude) : "");
    setLon(longitude != null ? String(longitude) : "");
  }, [latitude, longitude]);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) {
      return;
    }
    const startLat = latitude ?? 5.6037;
    const startLon = longitude ?? -0.187;
    const map = L.map(mapRef.current).setView([startLat, startLon], latitude != null ? 13 : 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    if (latitude != null && longitude != null) {
      markerObj.current = L.marker([latitude, longitude]).addTo(map);
    }
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (disabledRef.current) {
        return;
      }
      const { lat: nextLat, lng: nextLon } = event.latlng;
      setLat(nextLat.toFixed(6));
      setLon(nextLon.toFixed(6));
      if (markerObj.current) {
        markerObj.current.setLatLng([nextLat, nextLon]);
      } else {
        markerObj.current = L.marker([nextLat, nextLon]).addTo(map);
      }
    });
    mapObj.current = map;
    const resize = window.setTimeout(() => map.invalidateSize(), 50);
    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapObj.current = null;
      markerObj.current = null;
    };
    // Intentionally mount once; parent updates flow through lat/lon state + marker sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (latitude == null || longitude == null || !mapObj.current) {
      return;
    }
    mapObj.current.setView([latitude, longitude], Math.max(mapObj.current.getZoom(), 13));
    if (markerObj.current) {
      markerObj.current.setLatLng([latitude, longitude]);
    } else {
      markerObj.current = L.marker([latitude, longitude]).addTo(mapObj.current);
    }
  }, [latitude, longitude]);

  function useBrowserLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLon = position.coords.longitude;
        setLat(nextLat.toFixed(6));
        setLon(nextLon.toFixed(6));
        const map = mapObj.current;
        if (map) {
          map.setView([nextLat, nextLon], 14);
          if (markerObj.current) {
            markerObj.current.setLatLng([nextLat, nextLon]);
          } else {
            markerObj.current = L.marker([nextLat, nextLon]).addTo(map);
          }
        }
      },
      (geoError) => {
        setError(geoError.message || "Could not read browser location.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const nextLat = Number(lat);
    const nextLon = Number(lon);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
      setError("Enter valid latitude and longitude.");
      return;
    }
    try {
      await onSave(nextLat, nextLon);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save location.");
    }
  }

  return (
    <section className="ops-section" aria-labelledby="site-location-title">
      <h2 id="site-location-title">Location</h2>
      <p className="meta">
        Click the map, use browser GPS, or enter coordinates. Saved on the site for fleet maps.
      </p>
      <div ref={mapRef} className="site-map" role="presentation" />
      <form className="filter-bar" onSubmit={(event) => void onSubmit(event)}>
        <label className="filter-field">
          <span>Latitude</span>
          <input
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            inputMode="decimal"
            disabled={disabled}
          />
        </label>
        <label className="filter-field">
          <span>Longitude</span>
          <input
            value={lon}
            onChange={(event) => setLon(event.target.value)}
            inputMode="decimal"
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={useBrowserLocation}
          disabled={disabled || pending}
        >
          Use my location
        </button>
        <button type="submit" className="btn btn-primary" disabled={disabled || pending}>
          {pending ? "Saving…" : "Save location"}
        </button>
      </form>
      {error ? <p className="err">{error}</p> : null}
      {latitude != null && longitude != null ? (
        <p className="meta">
          Current: {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </p>
      ) : (
        <p className="meta">No coordinates saved yet.</p>
      )}
    </section>
  );
}
