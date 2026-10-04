"use client";

import { addTransitionType, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";
import styles from "./Modal.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

// Keep in sync with the .closing exit animation in Modal.module.css.
const EXIT_MS = 190;
// How far the sheet (mobile) has to be dragged down before letting go closes it.
const DISMISS_PX = 96;

/**
 * Modal shell for the intercepted entry view. Client-only so it can trap focus,
 * close on Escape/backdrop, and lock scroll; the content inside stays a Server
 * Component (spec §11.2).
 *
 * Close is deferred: we play an exit animation first, then router.back() (the
 * intercepting nav pushed the URL, so back returns to the grid). Scroll is
 * locked on <html>, which carries scrollbar-gutter: stable — so the reserved
 * gutter stays and nothing shifts sideways while the modal is open.
 */
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard: a ref flips immediately, so a repeated close() (double
  // click, Escape-then-click, or a concurrent re-render) can't schedule a second
  // router.back(). The side effect stays OUT of the state updater, which must be
  // pure — putting it there let React re-run it and fire back() twice.
  const closingRef = useRef(false);
  // Sheet drag: where the pointer went down, and whether it's past the detent.
  const drag = useRef<{ y0: number; past: boolean } | null>(null);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      // Tag the pop the same way Card tags the push, so the content well sits
      // this transition out too (see AppFrame). `<Link transitionTypes>` covers
      // the open direction; back() has no equivalent, so mark it by hand —
      // addTransitionType only counts inside a transition scope.
      startTransition(() => {
        addTransitionType("modal");
        router.back();
      });
    }, EXIT_MS);
  }, [router]);

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // preventScroll: focusing a tall panel would otherwise scroll it into view,
    // opening the modal a little scrolled down instead of at the top.
    panel?.focus({ preventScroll: true });
    panel?.parentElement?.scrollTo?.(0, 0);
    // On mobile the panel is the sheet, and the sheet is the scroller.
    panel?.scrollTo?.(0, 0);

    // Lock the document scroll. The gutter is reserved (scrollbar-gutter:stable
    // on <html>), so hiding overflow doesn't change width or shift the header.
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      restoreTo?.focus?.();
    };
  }, [close]);

  // ── Sheet drag-to-dismiss (mobile only; the handle is display:none elsewhere).
  // Lives on the handle, not the panel, so it never fights the content's scroll.
  const onDragStart = (e: React.PointerEvent) => {
    if (closingRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, past: false };
    panelRef.current?.classList.add(styles.dragging);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    // Down follows the finger; up resists, so the sheet can't be torn off the top.
    const dy = e.clientY - d.y0;
    const y = dy > 0 ? dy : dy / 6;
    panel.style.transform = `translateY(${y}px)`;
    const past = dy > DISMISS_PX;
    if (past !== d.past) {
      d.past = past;
      haptic("detent");
    }
  };
  const onDragEnd = () => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel) return;
    panel.classList.remove(styles.dragging);
    if (d.past) {
      // Exit from where the finger left it, not from the resting position.
      panel.style.setProperty("--drag", panel.style.transform.match(/-?[\d.]+px/)?.[0] ?? "0px");
      panel.style.transform = "";
      close();
    } else {
      panel.style.transform = ""; // the transition snaps it back
    }
  };

  return (
    <div
      className={`${styles.backdrop} ${closing ? styles.closing : ""}`}
      onMouseDown={close}
      // Unscoped name so the route-transition suppression in globals.css matches.
      style={{ viewTransitionName: "collection-modal" }}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={panelRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={styles.handle}
          aria-hidden
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        />
        <button className={styles.close} onClick={close} aria-label="Close" data-haptic="tick">
          ✕
        </button>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
