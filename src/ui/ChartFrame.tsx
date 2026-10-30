import type { ReactNode } from "react";

export function ChartFrame({
  title,
  caption,
  children,
  empty,
}: {
  title: string;
  caption: string;
  children?: ReactNode;
  empty?: string;
}) {
  return (
    <section className="chart-frame" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <p>{caption}</p>
      </header>
      <div className="chart-plot">
        {empty ? <p className="empty">{empty}</p> : children}
      </div>
    </section>
  );
}
