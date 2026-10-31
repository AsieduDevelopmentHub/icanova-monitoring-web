import type { ReactNode } from "react";

export type StripItem = {
  label: string;
  value: ReactNode;
  tone?: "default" | "ok" | "warn" | "alarm" | "offline" | "info";
};

/** Dense horizontal system-state strip for Command Center. */
export function StatusStrip({
  title,
  subtitle,
  items,
  trailing,
}: {
  title: string;
  subtitle?: string;
  items: StripItem[];
  trailing?: ReactNode;
}) {
  return (
    <section className="status-strip" aria-label={title}>
      <div className="status-strip-lead">
        <h2 className="status-strip-title">{title}</h2>
        {subtitle ? <p className="status-strip-sub">{subtitle}</p> : null}
      </div>
      <div className="status-strip-items">
        {items.map((item) => (
          <div key={item.label} className={`status-strip-item tone-${item.tone ?? "default"}`}>
            <span className="status-strip-label">{item.label}</span>
            <span className="status-strip-value">{item.value}</span>
          </div>
        ))}
      </div>
      {trailing ? <div className="status-strip-trailing">{trailing}</div> : null}
    </section>
  );
}
