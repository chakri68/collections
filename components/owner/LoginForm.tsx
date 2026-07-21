"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./owner.module.css";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(res.status === 429 ? "Too many attempts — wait a bit." : data.error ?? "Sign in failed.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <label className={styles.field}>
        <span className="label">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" className="btn primary" disabled={busy || password.length === 0}>
        {busy ? "…" : "Sign in"}
      </button>
    </form>
  );
}
