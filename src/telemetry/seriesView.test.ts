import { describe, expect, test } from "vitest";
import { BUCKET_MS } from "../../convex/limits";
import { chartSegments, downsample, foldMetric, type SeriesPoint } from "../../convex/rollup";

const point = (t: number, value: number | null, count = value === null ? 0 : 1): SeriesPoint => ({
  t,
  value,
  min: value,
  max: value,
  sum: value ?? 0,
  count,
});

describe("history folds", () => {
  test("unavailable values stay out of the sum and zero and negatives stay in", () => {
    const unavailable = foldMetric(null, null, false);
    expect(unavailable.count).toBe(0);
    const zero = foldMetric(unavailable, 0, true);
    expect(zero).toMatchObject({ min: 0, max: 0, sum: 0, count: 1, last: 0 });
    const negative = foldMetric(zero, -12.5, true);
    expect(negative).toMatchObject({ min: -12.5, max: 0, sum: -12.5, count: 2, last: -12.5 });
    const skipped = foldMetric(negative, null, false);
    expect(skipped.count).toBe(2);
    expect(skipped.last).toBe(-12.5);
  });

  test("a gap breaks the line and a null is not drawn as zero", () => {
    const points = [
      point(0, 10),
      point(BUCKET_MS, null),
      point(BUCKET_MS * 2, -4),
      point(BUCKET_MS * 5, 8),
    ];
    const segments = chartSegments(points, BUCKET_MS);
    expect(segments.map((segment) => segment.map((item) => item.value))).toEqual([[10], [-4], [8]]);
  });

  test("downsampling does not average across a gap", () => {
    const points = [point(0, 10), point(BUCKET_MS, 20), point(BUCKET_MS * 10, 30)];
    const reduced = downsample(points, 1, BUCKET_MS);
    expect(reduced).toHaveLength(2);
    expect(reduced[0]).toMatchObject({ value: 20, sum: 30, count: 2 });
    expect(reduced[1]).toMatchObject({ value: 30, sum: 30, count: 1 });
  });
});
