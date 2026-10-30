import { chartSegments, type SeriesPoint } from "../../convex/rollup";
import { BUCKET_MS } from "../../convex/limits";
import { ChartFrame } from "./ChartFrame";

export function SeriesChart({
  title,
  unit,
  points,
  reduced,
  caption,
}: {
  title: string;
  unit: string;
  points: SeriesPoint[];
  reduced: boolean;
  caption: string;
}) {
  const segments = chartSegments(points, BUCKET_MS);
  const measured = segments.flat();
  if (measured.length === 0) {
    return (
      <ChartFrame
        title={title}
        caption={caption}
        empty={`No measured ${title.toLowerCase()} in this range. Missing buckets are not drawn as zero.`}
      />
    );
  }
  const values = measured.flatMap((point) => [point.min ?? point.value ?? 0, point.max ?? point.value ?? 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 640;
  const height = 160;
  const span = max - min || 1;
  const start = measured[0]?.t ?? 0;
  const end = measured[measured.length - 1]?.t ?? start;
  const spanT = Math.max(end - start, 1);
  const xFor = (t: number) => 36 + ((t - start) / spanT) * (width - 48);
  const yFor = (value: number) => 16 + (1 - (value - min) / span) * (height - 40);
  return (
    <ChartFrame
      title={title}
      caption={`${caption}${reduced ? " Contiguous buckets were combined." : ""} Unit ${unit}.`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, ${unit}`}>
        <title>{title}</title>
        <line x1="36" y1="16" x2="36" y2={height - 24} className="chart-axis" />
        <line x1="36" y1={height - 24} x2={width - 8} y2={height - 24} className="chart-axis" />
        <text x="2" y="20" className="chart-label">
          {formatTick(max)}
        </text>
        <text x="2" y={height - 26} className="chart-label">
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
