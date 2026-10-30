import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDismiss(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return { panelRef, closeRef };
}

export function Drawer({
  open,
  title,
  side,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  side: "left" | "right";
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const { panelRef, closeRef } = useDismiss(open, onClose);
  if (!open) {
    return null;
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={`drawer ${side}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="overlay-head">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const { panelRef, closeRef } = useDismiss(open, onClose);
  if (!open) {
    return null;
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="overlay-head">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
}
