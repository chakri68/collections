"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./Modal.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Modal shell for the intercepted entry view. Client-only so it can trap focus,
 * close on Escape/backdrop, and lock body scroll; the content inside stays a
 * Server Component (spec §11.2). Closing is router.back() — the URL was pushed
 * by the intercepting navigation, so back returns to the grid with state intact.
 */
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    // Lock scroll under the modal without a layout jump.
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Focus trap.
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
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      restoreTo?.focus?.();
    };
  }, [close]);

  return (
    <div className={styles.backdrop} onMouseDown={close}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={panelRef}
        // Clicks inside the panel must not bubble to the backdrop's close.
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className={styles.close} onClick={close} aria-label="Close">
          ✕
        </button>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
