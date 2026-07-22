"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadSpotifyIframeApi,
  type SpotifyEmbedController,
} from "@/lib/spotify-iframe-api";
import styles from "./Embed.module.css";

interface SpotifyEmbedProps {
  /** Canonical Spotify page URL carrying `?theme=0`. NOT the /embed/ one. */
  url: string;
  height: number;
  /** Start playing as soon as the player is ready (the poster click is the gesture). */
  autoPlay?: boolean;
  /** API unreachable — the caller falls back to a plain iframe. */
  onUnavailable: () => void;
}

/**
 * Spotify player driven through the IFrame API instead of a raw <iframe>.
 *
 * The point is the controller: with a bare iframe our poster click only swapped
 * in the player and you had to press play a second time inside it. Here the
 * click creates the controller and calls play() on `ready`, so one click plays.
 */
export function SpotifyEmbed({
  url,
  height,
  autoPlay,
  onUnavailable,
}: SpotifyEmbedProps) {
  // Spotify replaces the node it's handed with its own iframe, so it gets an
  // inner div of its own. React only ever owns the wrapper.
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let controller: SpotifyEmbedController | null = null;

    // Two-arg then, not .then().catch() — a chained catch also swallows throws
    // from inside the success handler, which is exactly how a createController
    // rejecting its argument once hid behind a silent fallback to the iframe.
    loadSpotifyIframeApi().then(
      (api) => {
        if (cancelled || !hostRef.current) return;
        try {
          api.createController(hostRef.current, { url, width: "100%", height }, (created) => {
            if (cancelled) {
              created.destroy();
              return;
            }
            controller = created;
            created.addListener("ready", () => {
              setLoading(false);
              if (autoPlay) created.play();
            });
            // Autoplay can still be refused (the gesture doesn't always carry into
            // the frame). Nothing to do but leave the player sitting there ready
            // for a direct click — which is the old behaviour, not a failure.
            created.addListener("autoplay_failed", () => setLoading(false));
          });
        } catch (err) {
          // Bad argument, not a bad network — worth saying out loud rather than
          // quietly serving the fallback and looking like it worked.
          console.warn("[spotify] createController rejected its options:", err);
          if (!cancelled) onUnavailable();
        }
      },
      () => {
        if (!cancelled) onUnavailable();
      },
    );

    return () => {
      cancelled = true;
      try {
        controller?.destroy();
      } catch {
        // Already torn down with the subtree — nothing to clean up.
      }
    };
  }, [url, height, autoPlay, onUnavailable]);

  return (
    <div className={`${styles.frame} ${styles.controllerFrame}`} style={{ height }}>
      <div ref={hostRef} className={styles.controllerHost} />
      {loading && (
        <span className={styles.embedLoading} aria-hidden>
          loading…
        </span>
      )}
    </div>
  );
}
