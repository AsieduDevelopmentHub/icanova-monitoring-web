import type { SeriesPoint } from "../../convex/rollup";

/** Compact inline sparkline from stored series points (gaps stay gaps). */
export function Sparkline({
  points,
  label,
  width = 120,
  height = 28,
}: {
  points: SeriesPoint[];
  label: string;
  width?: number;
  height?: number;
}) {
  const measured = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (measured.length < 2) {
    return (
      <span className="sparkline-empty" aria-label={`${label}: insufficient data`}>
        —
      </span>
    );
  }
  const values = measured.map((p) => p.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const start = measured[0]!.t;
  const end = measured[measured.length - 1]!.t;
  const spanT = Math.max(end - start, 1);
  const d = measured
    .map((point, index) => {
      const x = ((point.t - start) / spanT) * width;
      const y = height - 2 - (((point.value as number) - min) / span) * (height - 4);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      <path className="sparkline-path" d={d} />
    </svg>
  );
}
