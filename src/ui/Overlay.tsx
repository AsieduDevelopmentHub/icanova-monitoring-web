import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Icon } from "./icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SWIPE_CLOSE_PX = 100;
const SWIPE_VELOCITY = 0.45;
const MOBILE_SHEET_MQ = "(max-width: 720px)";

function useDismiss(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
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
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [open]);

  return { panelRef, closeRef };
}

/** Mobile bottom-sheet: drag the handle/header down to dismiss. */
function useSwipeDismiss(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLDivElement | null>,
  handleRef: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const panel = panelRef.current;
    const handle = handleRef.current;
    if (!panel || !handle) {
      return;
    }

    let startY = 0;
    let startT = 0;
    let dragging = false;
    let active = false;

    const clearTransform = () => {
      panel.style.transform = "";
      panel.style.transition = "";
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!window.matchMedia(MOBILE_SHEET_MQ).matches) {
        return;
      }
      if (event.button !== 0 && event.pointerType === "mouse") {
        return;
      }
      dragging = true;
      active = true;
      startY = event.clientY;
      startT = performance.now();
      panel.style.transition = "none";
      handle.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || !active) {
        return;
      }
      const dy = Math.max(0, event.clientY - startY);
      panel.style.transform = `translateY(${dy}px)`;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging || !active) {
        return;
      }
      dragging = false;
      active = false;
      const dy = Math.max(0, event.clientY - startY);
      const dt = Math.max(1, performance.now() - startT);
      const velocity = dy / dt;
      panel.style.transition = "transform 180ms ease";
      if (dy >= SWIPE_CLOSE_PX || velocity >= SWIPE_VELOCITY) {
        panel.style.transform = "translateY(100%)";
        window.setTimeout(() => {
          clearTransform();
          onCloseRef.current();
        }, 160);
      } else {
        panel.style.transform = "translateY(0)";
        window.setTimeout(clearTransform, 180);
      }
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
    return () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
      clearTransform();
    };
  }, [open, panelRef, handleRef]);
}

export function Drawer({
  open,
  title,
  side,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  side: "left" | "right";
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const { panelRef, closeRef } = useDismiss(open, onClose);
  if (!open) {
    return null;
  }
  const panelClass = ["drawer", side, className].filter(Boolean).join(" ");
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={panelClass}
        id="app-navigation"
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

/** Sheet-first dialog: desktop right panel, mobile bottom sheet with swipe dismiss. */
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
  const handleRef = useRef<HTMLDivElement>(null);
  useSwipeDismiss(open, onClose, panelRef, handleRef);
  if (!open) {
    return null;
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="dialog sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-grab" ref={handleRef} aria-hidden="true">
          <span className="sheet-handle" />
        </div>
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
