/** Demonstration rows for the dashboard layout. Not a gateway and not Convex. */

export const FIXTURE_SOURCE =
  "Fixture. These rows are not a live fleet, a gateway, or Convex.";

export type FixtureEngine = "Running" | "Stopped" | "Warning" | "Fault";
export type FixtureLink = "ok" | "degraded" | "fail" | "unknown";

export type FixtureGenerator = {
  id: string;
  site: string;
  name: string;
  engine: FixtureEngine;
  link: FixtureLink;
  /** Null means the fixture has no reading. Zero is a fixture zero. */
  rpm: number | null;
  kw: number | null;
  loadPct: number | null;
};

export const fixtureGenerators: FixtureGenerator[] = [
  {
    id: "FX-01",
    site: "Fixture yard",
    name: "Set North",
    engine: "Running",
    link: "ok",
    rpm: 1500,
    kw: 86.4,
    loadPct: 62,
  },
  {
    id: "FX-02",
    site: "Fixture yard",
    name: "Set South",
    engine: "Stopped",
    link: "ok",
    rpm: 0,
    kw: 0,
    loadPct: 0,
  },
  {
    id: "FX-03",
    site: "Fixture quay",
    name: "Set East",
    engine: "Warning",
    link: "degraded",
    rpm: 1512,
    kw: 40.2,
    loadPct: 31,
  },
  {
    id: "FX-04",
    site: "Fixture quay",
    name: "Set West",
    engine: "Fault",
    link: "fail",
    rpm: null,
    kw: null,
    loadPct: null,
  },
  {
    id: "FX-05",
    site: "Fixture yard",
    name: "Set Spare",
    engine: "Stopped",
    link: "unknown",
    rpm: null,
    kw: 0,
    loadPct: 0,
  },
  {
    id: "FX-06",
    site: "Fixture quay",
    name: "Set Peak",
    engine: "Running",
    link: "ok",
    rpm: 1502,
    kw: 120.5,
    loadPct: 88,
  },
];

export const FIXTURE_ENGINES: FixtureEngine[] = [
  "Running",
  "Stopped",
  "Warning",
  "Fault",
];
