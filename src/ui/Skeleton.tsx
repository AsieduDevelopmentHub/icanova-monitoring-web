export function Skeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={["skeleton-stack", className].filter(Boolean).join(" ")} aria-hidden="true">
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
