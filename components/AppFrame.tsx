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
      <main className={styles.main}>{children}</main>
    </>
  );
}
