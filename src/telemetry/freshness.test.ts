import { describe, expect, test } from "vitest";
import { STORED_STALE_MS, pageFreshness, storedFreshness } from "./freshness";

describe("stored freshness", () => {
  test("fresh, stale, and unknown stay separate from a missing value", () => {
    const now = 1_000_000;
    expect(storedFreshness(now - 1_000, now).state).toBe("fresh");
    expect(storedFreshness(now - STORED_STALE_MS - 1, now)).toMatchObject({
      state: "stale",
      stale: true,
    });
    expect(storedFreshness(null, now).state).toBe("unknown");
    expect(storedFreshness(now + 5_000, now).state).toBe("unknown");
    expect(pageFreshness([{ updatedAt: now }, { updatedAt: null }], now)).toEqual({
      fresh: 1,
      stale: 0,
      unknown: 1,
      note: "In this page. Not a site total. Stale is age, not a failed link.",
    });
  });
});
