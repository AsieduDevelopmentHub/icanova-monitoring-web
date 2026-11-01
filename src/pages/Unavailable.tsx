import { Link, useLocation } from "react-router";
import { itemForPath } from "../shell/nav";
import { EmptyState } from "../ui/EmptyState";

export function Unavailable() {
  const { pathname } = useLocation();
  const item = itemForPath(pathname);
  const title = item?.label ?? "Unavailable";
  const detail =
    item?.unavailable ?? "This path is not a screen in iCaNova Monitoring.";

  return (
    <section className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <p>No operational screen is connected for this route.</p>
      </header>
      <EmptyState
        title="Nothing to show here"
        body={detail}
        action={<Link to="/app">Return to dashboard</Link>}
      />
    </section>
  );
}
