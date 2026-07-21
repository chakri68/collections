"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OwnerControls } from "./owner/OwnerControls";
import styles from "./SiteHeader.module.css";

export interface NavType {
  id: string;
  pluralLabel: string;
}

/**
 * Nav is generated from the registered types passed in (spec §5.1) — adding a
 * type never means editing a hardcoded nav component. Client-only so it can
 * mark the active route; the type list itself comes from the server.
 */
export function SiteHeader({ types }: { types: NavType[] }) {
  const pathname = usePathname();
  const is = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className={styles.header} style={{ viewTransitionName: "site-header" }}>
      <Link href="/" className={`${styles.brand} pixel`}>
        COLLECTION
      </Link>
      <nav className={styles.nav} aria-label="Sections">
        <Link href="/everything" className={`${styles.link} ${is("/everything") ? styles.active : ""}`}>
          Everything
        </Link>
        {types.map((t) => {
          const href = `/type/${t.id}`;
          return (
            <Link
              key={t.id}
              href={href}
              className={`${styles.link} ${is(href) ? styles.active : ""}`}
            >
              {t.pluralLabel}
            </Link>
          );
        })}
      </nav>
      <OwnerControls />
    </header>
  );
}
