import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  tone = "default",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "critical" | "warning";
}) {
  const classes = ["panel", tone !== "default" ? `panel-${tone}` : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={classes}>
      {title || description || actions ? (
        <header className="panel-head">
          <div className="panel-copy">
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {description ? <p className="panel-desc">{description}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
