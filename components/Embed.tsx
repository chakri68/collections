"use client";

import { useState } from "react";
import type { EmbedDescriptor } from "@/lib/content/types";
import styles from "./Embed.module.css";

// Only provider-generated embed origins may render (spec §11.3 / §14).
const ALLOWED_ORIGINS = new Set([
  "https://open.spotify.com",
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
]);

function isAllowed(src: string): boolean {
  try {
    return ALLOWED_ORIGINS.has(new URL(src).origin);
  } catch {
    return false;
  }
}

export function Embed({ embed, openUrl }: { embed: EmbedDescriptor; openUrl: string }) {
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!isAllowed(embed.src) || failed) {
    // Blocked or failed embed falls back to Open Original, never a broken frame.
    return (
      <a className="btn primary" href={openUrl} target="_blank" rel="noopener noreferrer">
        ↗ Open original
      </a>
    );
  }

  if (!active) {
    return (
      <button
        className={styles.poster}
        style={{ aspectRatio: embed.aspectRatio ?? "16 / 9" }}
        onClick={() => setActive(true)}
        aria-label={`Play ${embed.title}`}
      >
        <span className={styles.play}>▶</span>
        <span className={styles.posterLabel}>Play here</span>
      </button>
    );
  }

  return (
    <div className={styles.frame} style={{ aspectRatio: embed.aspectRatio ?? "16 / 9" }}>
      <iframe
        src={embed.src}
        title={embed.title}
        allow={embed.allow}
        loading="lazy"
        allowFullScreen
        onError={() => setFailed(true)}
      />
    </div>
  );
}
