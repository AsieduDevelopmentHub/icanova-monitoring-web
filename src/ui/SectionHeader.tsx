import type { ReactNode } from "react";

/** Command-center section title with optional lede and actions. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="cc-section-head">
      <div className="cc-section-copy">
        {eyebrow ? <p className="cc-eyebrow">{eyebrow}</p> : null}
        <h2 className="cc-section-title">{title}</h2>
        {description ? <p className="cc-section-desc">{description}</p> : null}
      </div>
      {actions ? <div className="cc-section-actions">{actions}</div> : null}
    </header>
  );
}
