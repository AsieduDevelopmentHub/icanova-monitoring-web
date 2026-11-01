/** Shimmer placeholders — prefer these over bare “Loading…” copy. */
export function Skeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={["skeleton-stack", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton-line"
          style={{ width: `${88 - (index % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

/** Full-page pending layout used while org/site/data resolve. */
export function PageSkeleton({
  rows = 5,
  label = "Loading",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="page-skeleton" role="status" aria-busy="true" aria-label={label}>
      <div className="page-skeleton-head">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-sub" />
      </div>
      <div className="page-skeleton-strip">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton-chip" />
        ))}
      </div>
      <Skeleton lines={rows} className="panel page-skeleton-body" />
    </div>
  );
}

/** Command Center pending — looping blocks that mirror the dashboard grid. */
export function DashboardSkeleton() {
  return (
    <div className="cc-skeleton" role="status" aria-busy="true" aria-label="Loading command center">
      <div className="cc-skeleton-loop" aria-hidden="true" />
      <div className="cc-skeleton-strip" style={{ animationDelay: "0ms" }}>
        <div className="skeleton-block skeleton-lead" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton-chip" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <div className="cc-skeleton-viz" style={{ animationDelay: "120ms" }}>
        <div className="skeleton-block skeleton-viz" />
        <div className="skeleton-block skeleton-side">
          <Skeleton lines={5} />
        </div>
      </div>
      <div className="skeleton-block skeleton-table" style={{ animationDelay: "220ms" }}>
        <Skeleton lines={6} />
      </div>
      <div className="cc-skeleton-charts" style={{ animationDelay: "320ms" }}>
        <div className="skeleton-block skeleton-chart" />
        <div className="skeleton-block skeleton-chart" />
        <div className="skeleton-block skeleton-chart" />
      </div>
    </div>
  );
}
