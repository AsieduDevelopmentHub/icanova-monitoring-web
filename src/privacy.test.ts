import { describe, expect, test } from "vitest";
import { analyticsPage } from "./analytics";
import { STORED_STALE_MS, storedFreshness } from "./telemetry/freshness";

describe("analytics privacy", () => {
  test("page views keep the path and drop the query and hash", () => {
    const page = analyticsPage({
      origin: "https://control.example",
      pathname: "/alarms",
    });
    expect(page).toEqual({
      page_path: "/alarms",
      page_location: "https://control.example/alarms",
    });
    expect(page.page_location).not.toContain("?");
    expect(page.page_location).not.toContain("rpm");
  });
});

describe("stored reading age", () => {
  test("a missing document is not shown as zero or stale", () => {
    expect(storedFreshness(null, 1_000_000)).toEqual({
      label: "No stored reading",
      stale: false,
      state: "unknown",
    });
  });

  test("a recent document is fresh and an old one is stale", () => {
    const now = 1_000_000;
    expect(storedFreshness(now - 1_000, now).stale).toBe(false);
    expect(storedFreshness(now - STORED_STALE_MS - 1, now)).toMatchObject({
      stale: true,
      label: "Last telemetry 3 min ago",
      state: "stale",
    });
  });
});
