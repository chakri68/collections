"use client";

import { useEffect, useSyncExternalStore } from "react";
import { haptic, hapticFor, hapticsEnabled, setHapticsEnabled, subscribeHaptics } from "@/lib/haptics";
import styles from "./Haptics.module.css";

/**
 * One document-level click listener, so markup stays the source of truth
 * (`data-haptic`, or the class defaults in lib/haptics). Fires on click, not
 * touch-down, so a cancelled tap stays silent.
 */
export function HapticsListener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const p = hapticFor(e.target);
      if (p) haptic(p);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

/** Header toggle. Only rendered visible on touch devices (see the CSS). */
export function HapticsToggle() {
  // Server snapshot is "on" (the default), so hydration never mismatches.
  const on = useSyncExternalStore(subscribeHaptics, hapticsEnabled, () => true);
  return (
    <button
      type="button"
      className={`${styles.toggle} ${on ? styles.on : ""}`}
      aria-pressed={on}
      aria-label="Haptics"
      title={on ? "Haptics on" : "Haptics off"}
      onClick={() => {
        setHapticsEnabled(!on);
        // Turning it on should feel like something. Turning it off, by
        // definition, shouldn't.
        if (!on) haptic("tick");
      }}
    >
      ≋
    </button>
  );
}
