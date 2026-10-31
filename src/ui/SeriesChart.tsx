import { chartSegments, type SeriesPoint } from "../../convex/rollup";
import { BUCKET_MS } from "../../convex/limits";
import { ChartFrame } from "./ChartFrame";

export function SeriesChart({
  title,
  unit,
  points,
  reduced,
  caption,
  height = 220,
}: {
  title: string;
  unit: string;
  points: SeriesPoint[];
  reduced: boolean;
  caption?: string;
  height?: number;
}) {
  const segments = chartSegments(points, BUCKET_MS);
  const measured = segments.flat();
  if (measured.length === 0) {
    return (
      <ChartFrame
        title={title}
        caption={caption ?? `${unit}`}
        empty={`No measured ${title.toLowerCase()}. Gaps are not drawn as zero.`}
      />
    );
  }
  const values = measured.flatMap((point) => [point.min ?? point.value ?? 0, point.max ?? point.value ?? 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 720;
  const span = max - min || 1;
  const start = measured[0]?.t ?? 0;
  const end = measured[measured.length - 1]?.t ?? start;
  const spanT = Math.max(end - start, 1);
  const xFor = (t: number) => 40 + ((t - start) / spanT) * (width - 56);
  const yFor = (value: number) => 14 + (1 - (value - min) / span) * (height - 36);
  const mid = (min + max) / 2;
  const quietCaption = [caption, reduced ? "Downsampled" : null, unit]
    .filter(Boolean)
    .join(" · ");
  return (
    <ChartFrame title={title} caption={quietCaption}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, ${unit}`}>
        <title>{title}</title>
        <line x1="40" y1={yFor(mid)} x2={width - 12} y2={yFor(mid)} className="chart-grid" />
        <line x1="40" y1="14" x2="40" y2={height - 22} className="chart-axis" />
        <line x1="40" y1={height - 22} x2={width - 12} y2={height - 22} className="chart-axis" />
        <text x="4" y="18" className="chart-label">
          {formatTick(max)}
        </text>
        <text x="4" y={height - 24} className="chart-label">
          {formatTick(min)}
        </text>
        {segments.map((segment, index) => (
          <path
            key={segment[0]?.t ?? index}
            className="chart-series"
            d={segment
              .map((point, pointIndex) => {
                const value = point.value ?? point.min ?? 0;
                const command = pointIndex === 0 ? "M" : "L";
                return `${command}${xFor(point.t).toFixed(1)} ${yFor(value).toFixed(1)}`;
              })
              .join(" ")}
          />
        ))}
      </svg>
    </ChartFrame>
  );
}

function formatTick(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}
