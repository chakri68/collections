/**
 * Small, public site-level config. Not secrets — just handles/links the UI needs.
 * Env override wins so it can differ per deploy without a code change.
 */

/** Instagram handle (no @) for the "Suggest something" box. Empty → box hidden. */
export const INSTAGRAM_HANDLE =
  process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? "chakri.68";
