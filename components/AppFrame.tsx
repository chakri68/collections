import { ViewTransition } from "react";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { typesPresent } from "@/lib/content/query";
import { getContentType } from "@/lib/content/registry/content-types";
import { BootScreen } from "./BootScreen";
import { SiteHeader, type NavType } from "./SiteHeader";
import styles from "./AppFrame.module.css";

/**
 * Server chrome shared by every route: boot curtain + generated nav + main well.
 * Nav is derived from the types actually present in the collection, ordered by
 * count — so it stays honest without a hardcoded list.
 */
export async function AppFrame({ children }: { children: React.ReactNode }) {
  const snapshot = await loadPublicSnapshot();
  const types: NavType[] = typesPresent(snapshot).map((t) => ({
    id: t.type,
    pluralLabel: getContentType(t.type).pluralLabel,
  }));

  return (
    <>
      <BootScreen />
      <SiteHeader types={types} />
      <main className={styles.main}>
        {/* Animate the content on every route change; the header is anchored
            (see globals.css) so only this well moves. `default` (not
            enter/exit) is what matters here: this boundary persists across
            navigations, so each nav is an *update*, not a mount/unmount —
            enter/exit classes would never apply. Fires on client navs only.

            Opening or closing the modal is tagged "modal" (Card's Link and
            Modal's close), and that case maps to "none": the well isn't going
            anywhere, so replaying its exit/enter under the modal is just the
            page flinching for no reason. */}
        <ViewTransition default="screen" update={{ modal: "none", default: "screen" }}>
          {children}
        </ViewTransition>
      </main>
    </>
  );
}
