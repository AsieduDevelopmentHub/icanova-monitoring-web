import type { ReactNode } from "react";

/** Large technical value with mono label — for system state strips. */
export function TechValue({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "alarm" | "offline" | "info";
}) {
  return (
    <div className={`tech-value tone-${tone}`}>
      <span className="tech-value-label">{label}</span>
      <span className="tech-value-data">{value}</span>
      {hint ? <span className="tech-value-hint">{hint}</span> : null}
    </div>
  );
}
