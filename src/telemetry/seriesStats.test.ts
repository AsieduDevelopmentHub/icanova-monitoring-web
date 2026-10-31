import { describe, expect, it } from "vitest";
import { formatStat, seriesStats } from "./seriesStats";

describe("seriesStats", () => {
  it("ignores empty buckets and averages measured counts", () => {
    const stats = seriesStats([
      { t: 0, value: 10, min: 8, max: 12, sum: 20, count: 2 },
      { t: 1, value: null, min: null, max: null, sum: 0, count: 0 },
      { t: 2, value: 4, min: 4, max: 6, sum: 10, count: 2 },
    ]);
    expect(stats).toEqual({
      count: 4,
      min: 4,
      max: 12,
      average: 7.5,
      latest: 4,
      bucketsWithData: 2,
    });
  });

  it("formats missing stats as an em dash", () => {
    expect(formatStat(null)).toBe("—");
    expect(formatStat(1.2345, 1)).toBe("1.2");
  });
});
