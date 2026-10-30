export function Metric({
  label,
  value,
  unit,
  note,
  selected,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  selected?: boolean;
}) {
  return (
    <div className={selected ? "metric is-selected" : "metric"}>
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
