"use client";

import { useEffect, useState } from "react";
import styles from "./BootScreen.module.css";

const COPY = [
  "Opening the archive",
  "Rewinding the tapes",
  "Dusting the shelves",
  "Warming the phosphor",
];

// Session flag: the sequence plays once per tab, then repeat navigations skip it.
const SEEN_KEY = "collection:booted";

/**
 * The intentional opening sequence (spec §10). Blocks nothing real — the page
 * is already rendered underneath; this is a themed curtain that lifts. Kept
 * short on repeat visits and replaced by a quiet fade under reduced-motion.
 */
export function BootScreen() {
  const [phase, setPhase] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) !== null;
    } catch {}

    // Repeat visit or reduced motion → a quick, quiet reveal.
    const total = seen || reduce ? 350 : 1900;
    const steps = seen || reduce ? 1 : COPY.length;

    for (let i = 1; i <= steps; i++) {
      timers.push(setTimeout(() => setPhase(i), (total / (steps + 1)) * i));
    }
    timers.push(
      setTimeout(() => {
        setDone(true);
        try {
          sessionStorage.setItem(SEEN_KEY, "1");
        } catch {}
      }, total),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  // Unmount fully after the fade so it never traps focus/pointer.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setPhase(-1), 550);
    return () => clearTimeout(t);
  }, [done]);

  if (phase === -1) return null;

  const pct = Math.round((Math.min(phase, COPY.length) / COPY.length) * 100);

  return (
    <div
      className={`${styles.overlay} ${done ? styles.done : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={done}
    >
      <div className={styles.inner}>
        <div className={`${styles.title} pixel`}>COLLECTION</div>
        <div className={styles.copy}>
          {`${COPY[Math.min(Math.max(phase - 1, 0), COPY.length - 1)]}…`}
        </div>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${done ? 100 : pct}%` }} />
        </div>
      </div>
    </div>
  );
}
