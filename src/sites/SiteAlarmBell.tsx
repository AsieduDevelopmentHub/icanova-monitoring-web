import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Icon } from "../ui/icons";

export function SiteAlarmBell({
  siteId,
  siteLabel,
  issues,
}: {
  siteId: string;
  siteLabel: string;
  issues: string[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (issues.length === 0) {
    return null;
  }

  return (
    <span className="site-alarm-bell" ref={rootRef}>
      <button
        type="button"
        className="site-alarm-bell-btn"
        aria-label={`${issues.length} attention items for ${siteLabel}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" />
      </button>
      {open ? (
        <div className="site-alarm-popover" id={panelId} role="dialog" aria-label="Site attention">
          <header className="site-alarm-popover-head">
            <strong>{siteLabel}</strong>
            <Link to="/alarms" onClick={() => setOpen(false)}>
              Alarms
            </Link>
          </header>
          <ul className="site-alarm-list">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <Link className="site-alarm-open" to={`/sites/${siteId}`} onClick={() => setOpen(false)}>
            Open site desk
          </Link>
        </div>
      ) : null}
    </span>
  );
}
