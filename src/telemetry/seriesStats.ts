import type { SeriesPoint } from "../../convex/rollup";

export type SeriesStats = {
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  latest: number | null;
  bucketsWithData: number;
};

/** Aggregate measured bucket folds only. Null/empty buckets are gaps, not zeros. */
export function seriesStats(points: SeriesPoint[]): SeriesStats {
  let count = 0;
  let sum = 0;
  let min: number | null = null;
  let max: number | null = null;
  let latest: number | null = null;
  let bucketsWithData = 0;
  for (const point of points) {
    if (point.count <= 0) {
      continue;
    }
    bucketsWithData += 1;
    count += point.count;
    sum += point.sum;
    if (point.min !== null && Number.isFinite(point.min)) {
      min = min === null ? point.min : Math.min(min, point.min);
    }
    if (point.max !== null && Number.isFinite(point.max)) {
      max = max === null ? point.max : Math.max(max, point.max);
    }
    if (point.value !== null && Number.isFinite(point.value)) {
      latest = point.value;
    }
  }
  return {
    count,
    min,
    max,
    average: count > 0 ? sum / count : null,
    latest,
    bucketsWithData,
  };
}

export function formatStat(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits);
}
