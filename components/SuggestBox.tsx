"use client";

import { useState } from "react";
import { INSTAGRAM_HANDLE } from "@/lib/site-config";
import styles from "./SuggestBox.module.css";

/**
 * "Suggest something" box. Instagram has no pre-filled-DM URL, so on send we
 * copy the suggestion to the clipboard and open the DM thread (ig.me/m/<handle>)
 * — one paste and it's sent. Falls back to opening the profile if the DM deep
 * link is unavailable. Renders nothing if no handle is configured.
 */
export function SuggestBox() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  if (!INSTAGRAM_HANDLE) return null;

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // Clipboard blocked — still open the DM; the visitor can retype.
      setCopied(false);
    }
    window.open(`https://ig.me/m/${INSTAGRAM_HANDLE}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section className={styles.box}>
      <h2 className={`${styles.title} prompt`}>Think I&apos;m missing something?</h2>
      <p className={styles.lead}>
        Tell me what belongs in here. Hit send and it copies to your clipboard and
        opens my Instagram DMs — just paste.
      </p>
      <div className={styles.row}>
        <textarea
          className={styles.input}
          rows={2}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCopied(false);
          }}
          placeholder="You HAVE to add…"
          aria-label="Your suggestion"
        />
        <button className="btn primary" onClick={send} disabled={text.trim().length === 0}>
          Send it →
        </button>
      </div>
      {copied && (
        <p className={styles.copied} role="status">
          Copied — paste it in the DM that just opened. 📋
        </p>
      )}
    </section>
  );
}
