import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { Icon } from "../ui/icons";

type PopoverPos = { top: number; left: number; width: number };

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
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }
    function place() {
      const btn = btnRef.current;
      if (!btn) {
        return;
      }
      const rect = btn.getBoundingClientRect();
      const width = Math.min(288, Math.max(220, window.innerWidth - 16));
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      const below = rect.bottom + 6;
      const estHeight = 160;
      const top =
        below + estHeight > window.innerHeight - 8
          ? Math.max(8, rect.top - estHeight - 6)
          : below;
      setPos({ top, left, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
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
        ref={btnRef}
        type="button"
        className="site-alarm-bell-btn"
        aria-label={`${issues.length} attention items for ${siteLabel}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Icon name="bell" />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="site-alarm-popover is-portal"
              id={panelId}
              role="dialog"
              aria-label="Site attention"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
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
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
