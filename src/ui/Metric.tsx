import type { ReactNode } from "react";
import type { StatusTone } from "./StatusMark";

export function Metric({
  label,
  value,
  unit,
  note,
  selected,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  selected?: boolean;
  tone?: StatusTone;
  /** Visually elevates attention metrics without inventing new data. */
  emphasis?: boolean;
}) {
  const classes = [
    "metric",
    selected ? "is-selected" : null,
    emphasis ? "is-emphasis" : null,
    tone ? `metric-${tone}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {note ? <div className="metric-note">{note}</div> : null}
    </div>
  );
}

export function formatMeasure(
  value: number | null | undefined,
  digits: number,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}
