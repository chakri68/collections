"use client";

import { useEffect, useState } from "react";

// Module-level cache so every owner control shares one probe per page load.
let cached: Promise<boolean> | null = null;

function probe(): Promise<boolean> {
  cached ??= fetch("/api/auth/session", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { owner: false }))
    .then((d) => Boolean(d.owner))
    .catch(() => false);
  return cached;
}

/** Reset the cache after login/logout so controls re-probe. */
export function resetOwnerProbe() {
  cached = null;
}

export function useOwner(): boolean | null {
  const [owner, setOwner] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    probe().then((v) => alive && setOwner(v));
    return () => {
      alive = false;
    };
  }, []);
  return owner;
}
