import type { MetadataRoute } from "next";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { typesPresent } from "@/lib/content/query";
import { SITE_URL } from "@/lib/site-config";

/** Every public route: the home + everything, one page per present type, and one
 *  per published item (using its updatedAt as lastModified). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const snapshot = await loadPublicSnapshot();

  const types: MetadataRoute.Sitemap = typesPresent(snapshot).map((t) => ({
    url: `${SITE_URL}/type/${t.type}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const items: MetadataRoute.Sitemap = snapshot.items.map((i) => ({
    url: `${SITE_URL}/item/${i.slug}`,
    lastModified: i.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/everything`, changeFrequency: "weekly", priority: 0.8 },
    ...types,
    ...items,
  ];
}
