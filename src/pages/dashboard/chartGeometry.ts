/** Polar helpers for the site-count horseshoe (cutout faces right). */

export type ArcSeg = { value: number; color: string };

const DEG = Math.PI / 180;

export function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = angleDeg * DEG;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG arc path. Angles in degrees, SVG coords (0° = east, CW positive via sweep). */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  if (sweep < 0.01) {
    return "";
  }
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Horseshoe opening to the right: visible 300° from 30° → 330° (gap ±30° around east).
 * Segments share that visible span proportionally.
 */
export function horseshoeSegments(
  cx: number,
  cy: number,
  r: number,
  segments: ArcSeg[],
  visibleStart = 30,
  visibleSweep = 300,
): { d: string; color: string }[] {
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.value), 0);
  if (total <= 0) {
    return [
      {
        d: arcPath(cx, cy, r, visibleStart, visibleStart + visibleSweep),
        color: "var(--line)",
      },
    ];
  }
  let cursor = visibleStart;
  const out: { d: string; color: string }[] = [];
  for (const seg of segments) {
    const share = (Math.max(0, seg.value) / total) * visibleSweep;
    if (share < 0.05) {
      continue;
    }
    const end = cursor + share;
    out.push({ d: arcPath(cx, cy, r, cursor, end), color: seg.color });
    cursor = end;
  }
  return out;
}
