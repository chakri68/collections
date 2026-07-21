/**
 * Small, public site-level config. Not secrets — just handles/links the UI needs.
 * Env override wins so it can differ per deploy without a code change.
 */

/** Instagram handle (no @) for the "Suggest something" box. Empty → box hidden. */
export const INSTAGRAM_HANDLE =
  process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? "chakri.68";

/**
 * Canonical public origin. Drives metadataBase, canonical URLs, robots, and the
 * sitemap. Env override wins so a preview deploy can point at itself.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lib.chakri.me";
