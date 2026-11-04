import { describe, expect, test } from "vitest";
import {
  decideIpLocation,
  haversineKm,
  isPrivateOrReservedIp,
  MOVE_KM,
  PENDING_CONFIRMS,
} from "../../convex/geoMath";

describe("geoMath haversine", () => {
  test("same point is zero", () => {
    expect(haversineKm(5.6, -0.2, 5.6, -0.2)).toBe(0);
  });

  test("Accra to Kumasi is hundreds of km", () => {
    const km = haversineKm(5.6037, -0.187, 6.6885, -1.6244);
    expect(km).toBeGreaterThan(150);
    expect(km).toBeLessThan(250);
  });
});

describe("geoMath private IP", () => {
  test("flags RFC1918 and loopback", () => {
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.1.2")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
  });

  test("allows public v4", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
  });
});

describe("decideIpLocation", () => {
  const accra = { lat: 5.6037, lon: -0.187 };
  const nearAccra = { lat: 5.61, lon: -0.18 };
  const kumasi = { lat: 6.6885, lon: -1.6244 };

  test("seeds empty site immediately", () => {
    const d = decideIpLocation({
      currentLat: null,
      currentLon: null,
      source: undefined,
      pendingLat: null,
      pendingLon: null,
      pendingCount: null,
      pendingIpKey: null,
      fixLat: accra.lat,
      fixLon: accra.lon,
      ipKey: "abc",
    });
    expect(d).toEqual({ action: "apply", clearPending: true });
  });

  test("ignores IP jitter under 5 km", () => {
    const d = decideIpLocation({
      currentLat: accra.lat,
      currentLon: accra.lon,
      source: "ip",
      pendingLat: null,
      pendingLon: null,
      pendingCount: null,
      pendingIpKey: null,
      fixLat: nearAccra.lat,
      fixLon: nearAccra.lon,
      ipKey: "abc",
    });
    expect(d.action).toBe("ignore");
  });

  test("applies larger IP refresh when source is ip", () => {
    const d = decideIpLocation({
      currentLat: accra.lat,
      currentLon: accra.lon,
      source: "ip",
      pendingLat: null,
      pendingLon: null,
      pendingCount: null,
      pendingIpKey: null,
      fixLat: kumasi.lat,
      fixLon: kumasi.lon,
      ipKey: "abc",
    });
    expect(d).toEqual({ action: "apply", clearPending: true });
  });

  test("manual near fix is ignored", () => {
    expect(haversineKm(accra.lat, accra.lon, nearAccra.lat, nearAccra.lon)).toBeLessThan(MOVE_KM);
    const d = decideIpLocation({
      currentLat: accra.lat,
      currentLon: accra.lon,
      source: "manual",
      pendingLat: null,
      pendingLon: null,
      pendingCount: null,
      pendingIpKey: null,
      fixLat: nearAccra.lat,
      fixLon: nearAccra.lon,
      ipKey: "abc",
    });
    expect(d).toMatchObject({ action: "ignore", reason: "within_move_threshold" });
  });

  test("manual far fix needs three confirms", () => {
    let pendingLat: number | null = null;
    let pendingLon: number | null = null;
    let pendingCount: number | null = null;
    for (let i = 1; i < PENDING_CONFIRMS; i += 1) {
      const d = decideIpLocation({
        currentLat: accra.lat,
        currentLon: accra.lon,
        source: "manual",
        pendingLat,
        pendingLon,
        pendingCount,
        pendingIpKey: "abc",
        fixLat: kumasi.lat,
        fixLon: kumasi.lon,
        ipKey: "abc",
      });
      expect(d.action).toBe("pending");
      if (d.action === "pending") {
        pendingLat = d.lat;
        pendingLon = d.lon;
        pendingCount = d.count;
        expect(d.count).toBe(i);
      }
    }
    const applied = decideIpLocation({
      currentLat: accra.lat,
      currentLon: accra.lon,
      source: "manual",
      pendingLat,
      pendingLon,
      pendingCount,
      pendingIpKey: "abc",
      fixLat: kumasi.lat,
      fixLon: kumasi.lon,
      ipKey: "abc",
    });
    expect(applied).toEqual({ action: "apply", clearPending: true });
  });

  test("divergent pending resets count", () => {
    const first = decideIpLocation({
      currentLat: accra.lat,
      currentLon: accra.lon,
      source: "browser",
      pendingLat: null,
      pendingLon: null,
      pendingCount: null,
      pendingIpKey: null,
      fixLat: kumasi.lat,
      fixLon: kumasi.lon,
      ipKey: "a",
    });
    expect(first).toMatchObject({ action: "pending", count: 1 });
    const tamale = { lat: 9.4034, lon: -0.8424 };
    const reset = decideIpLocation({
      currentLat: accra.lat,
      currentLon: accra.lon,
      source: "browser",
      pendingLat: kumasi.lat,
      pendingLon: kumasi.lon,
      pendingCount: 2,
      pendingIpKey: "a",
      fixLat: tamale.lat,
      fixLon: tamale.lon,
      ipKey: "b",
    });
    expect(reset).toMatchObject({ action: "pending", count: 1, lat: tamale.lat, lon: tamale.lon });
  });
});
