"use client";

import Link, { useLinkStatus } from "next/link";
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
        <NavLink href="/everything" active={is("/everything")}>
          Everything
        </NavLink>
        {types.map((t) => {
          const href = `/type/${t.id}`;
          return (
            <NavLink key={t.id} href={href} active={is(href)}>
              {t.pluralLabel}
            </NavLink>
          );
        })}
      </nav>
      <OwnerControls />
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${styles.link} ${active ? styles.active : ""}`}>
      {children}
      <NavPending />
    </Link>
  );
}

/**
 * Tab loading state. These routes are static and prefetched, so most clicks skip
 * the pending phase entirely — this is for the cold ones, where the tab would
 * otherwise look inert until the new screen arrives.
 *
 * Absolutely positioned and opacity-toggled: an indicator that took up space
 * would nudge the whole nav sideways the moment you clicked it.
 */
function NavPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`${styles.pending} ${pending ? styles.pendingOn : ""}`} />;
}
