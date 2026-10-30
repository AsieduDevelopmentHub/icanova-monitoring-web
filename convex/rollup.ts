/** Measured numbers only. Unavailable samples must not enter the sum. */

export type MetricFold = {
  min: number | null;
  max: number | null;
  sum: number;
  count: number;
  last: number | null;
};

export type LinkTally = {
  ok: number;
  fail: number;
  degraded: number;
  other: number;
};

export type SeriesPoint = {
  t: number;
  value: number | null;
  min: number | null;
  max: number | null;
  sum: number;
  count: number;
};

const emptyFold = (): MetricFold => ({ min: null, max: null, sum: 0, count: 0, last: null });

export function foldMetric(previous: MetricFold | null, value: number | null, measured: boolean): MetricFold {
  const base = previous ?? emptyFold();
  if (!measured || value === null || !Number.isFinite(value)) {
    return base;
  }
  return {
    min: base.min === null ? value : Math.min(base.min, value),
    max: base.max === null ? value : Math.max(base.max, value),
    sum: base.sum + value,
    count: base.count + 1,
    last: value,
  };
}

export function linkBucket(link: string | null): keyof LinkTally {
  if (link === "ok" || link === "fail" || link === "degraded") {
    return link;
  }
  return "other";
}

export function shiftLink(
  tally: LinkTally,
  from: string | null,
  to: string | null,
  hadPrevious: boolean,
): LinkTally {
  const next = { ...tally };
  if (hadPrevious) {
    const key = linkBucket(from);
    next[key] = Math.max(0, next[key] - 1);
  }
  next[linkBucket(to)] += 1;
  return next;
}

export function chartSegments(points: SeriesPoint[], bucketMs: number): SeriesPoint[][] {
  const segments: SeriesPoint[][] = [];
  let current: SeriesPoint[] = [];
  for (const point of points) {
    if (point.count <= 0 || point.value === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    const previous = current[current.length - 1];
    if (previous && point.t - previous.t > bucketMs * 1.5) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

function mergePoints(group: SeriesPoint[]): SeriesPoint {
  let min: number | null = null;
  let max: number | null = null;
  let sum = 0;
  let count = 0;
  let value: number | null = null;
  for (const point of group) {
    if (point.min !== null && (min === null || point.min < min)) {
      min = point.min;
    }
    if (point.max !== null && (max === null || point.max > max)) {
      max = point.max;
    }
    sum += point.sum;
    count += point.count;
    if (point.value !== null && point.count > 0) {
      value = point.value;
    }
  }
  return { t: group[0]?.t ?? 0, value, min, max, sum, count };
}

/** Combine contiguous buckets. A time gap starts a new point and is not averaged across. */
export function downsample(points: SeriesPoint[], limit: number, bucketMs: number): SeriesPoint[] {
  if (points.length <= limit) {
    return points;
  }
  const size = Math.ceil(points.length / limit);
  const out: SeriesPoint[] = [];
  let group: SeriesPoint[] = [];
  const flush = () => {
    if (group.length === 0) {
      return;
    }
    out.push(mergePoints(group));
    group = [];
  };
  for (const point of points) {
    const previous = group[group.length - 1];
    if (previous && point.t - previous.t > bucketMs * size * 1.5) {
      flush();
    }
    group.push(point);
    if (group.length >= size) {
      flush();
    }
  }
  flush();
  return out;
}
