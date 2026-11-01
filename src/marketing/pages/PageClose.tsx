import { Link } from "react-router";
import { useConvexAuth } from "convex/react";

type PageCloseProps = {
  eyebrow?: string;
  title: string;
  body: string;
  secondaryTo?: string;
  secondaryLabel?: string;
};

export function PageClose({
  eyebrow = "Next step",
  title,
  body,
  secondaryTo = "/contact",
  secondaryLabel = "Contact",
}: PageCloseProps) {
  const { isAuthenticated } = useConvexAuth();
  const exploreTo = isAuthenticated ? "/app" : "/auth/login";
  const exploreLabel = isAuthenticated ? "Open platform" : "Get started";

  return (
    <section className="mkt-close-band" data-mkt-reveal data-mkt-from="scale">
      <div className="mkt-inner mkt-close-card">
        <div>
          <p className="mkt-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <div className="mkt-cta-row">
          <Link className="mkt-btn mkt-btn-primary mkt-btn-lg" to={exploreTo}>
            {exploreLabel}
          </Link>
          <Link className="mkt-btn mkt-btn-secondary mkt-btn-lg" to={secondaryTo}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
