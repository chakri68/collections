/** URL parsing helpers shared by adapters. Pure, no network. */

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "si", "igshid", "fbclid", "gclid", "yclid", "mc_cid", "mc_eid",
  "ref", "ref_src", "spm", "_hsenc", "_hsmi", "vero_id",
]);

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

/** Pull every http(s) URL out of a free-text blob, de-duplicated, order-preserving. */
export function extractUrls(...parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const match of part.matchAll(URL_RE)) {
      const url = match[0].replace(/[.,]+$/, ""); // trailing sentence punctuation
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }
  return out;
}

/** Strip known tracking params. Returns the input unchanged if it doesn't parse. */
export function stripTracking(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    // Normalize: lowercase host, drop trailing slash on non-root paths.
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/** Bare host without leading www., or "" if unparseable. */
export function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function safeParse(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}
