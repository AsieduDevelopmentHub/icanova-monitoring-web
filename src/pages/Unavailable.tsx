import { useLocation } from "react-router";
import { itemForPath } from "../shell/nav";

export function Unavailable() {
  const { pathname } = useLocation();
  const item = itemForPath(pathname);
  const title = item?.label ?? "Unknown";
  const detail =
    item?.unavailable ??
    "This path is not a screen in the control center.";

  return (
    <section className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <p>No backend is connected for this area.</p>
      </header>
      <div className="notice">{detail}</div>
    </section>
  );
}
