"use client";

import { useLinkStatus } from "next/link";
import styles from "./Card.module.css";

/**
 * Click feedback for a card. Next won't prefetch a URL that an interception
 * route will catch, so the modal can't open until the server responds — with
 * nothing on screen, a slow response reads as a dead click. This lights up the
 * moment the navigation starts and goes away when the modal takes over.
 *
 * Always rendered at a fixed size and toggled by opacity, so it can't shift the
 * card's layout.
 */
export function CardPending() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`${styles.pending} ${pending ? styles.pendingOn : ""}`}>
      <span className={styles.pendingRing} />
    </span>
  );
}
