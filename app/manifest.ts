import type { MetadataRoute } from "next";

/**
 * Installable manifest. The `share_target` block is what lets the OS share
 * sheet hand URLs/text to the PWA (spec §9); the capture route that consumes
 * it lands in Phase 2. Declared now so the install surface is complete.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collection",
    short_name: "Collection",
    description:
      "A small personal museum of things worth keeping — and the reason each one was kept.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    // Not yet in the official Next manifest types in every version; the share
    // target is a valid manifest member. Cast keeps it declared without fighting types.
    ...({
      share_target: {
        action: "/capture",
        method: "GET",
        params: { title: "title", text: "text", url: "url" },
      },
    } as object),
  };
}
