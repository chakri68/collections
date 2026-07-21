"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOwner, resetOwnerProbe } from "./useOwner";
import styles from "./OwnerControls.module.css";

/** Header controls that only appear for the signed-in owner. */
export function OwnerControls() {
  const owner = useOwner();
  const router = useRouter();

  if (owner === null) return null; // don't flash anything until the probe resolves

  if (!owner) {
    return (
      <Link href="/login" className={styles.subtle} aria-label="Owner sign in">
        ⌂
      </Link>
    );
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    resetOwnerProbe();
    router.refresh();
  }

  return (
    <div className={styles.controls}>
      <Link href="/capture" className={styles.add}>
        + Add
      </Link>
      <button className={styles.subtle} onClick={signOut} aria-label="Sign out">
        ⏻
      </button>
    </div>
  );
}
