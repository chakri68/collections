import "server-only";
import { createHash } from "node:crypto";
import { safeGet, readCapped } from "./metadata";
import { itemYear } from "../git/committer";
import type { ContentItem } from "../content/types";

/**
 * Artwork mirroring (spec §8.1 step 6, §12): og-image links rot, so on save the
 * server pulls the bytes into the repo next to the item JSON and rewrites
 * artwork.src to a path we serve ourselves (app/artwork/[...path]/route.ts).
 *
 * Two inputs arrive here: a remote http(s) URL (from enrichment or a pasted
 * link) and a data: URL (a file uploaded in the form). Remote mirroring is
 * best-effort — a flaky image host shouldn't block the save, and the remote URL
 * still renders in the meantime. An upload has no fallback: if it doesn't
 * decode, the save fails loudly instead of committing a data: blob to JSON.
 */

export const ARTWORK_DIR = "content/images";
export const ARTWORK_ROUTE = "/artwork";

/** Formats we store and serve. No SVG — same-origin SVG can carry script. */
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const ARTWORK_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_TYPE).map(([type, ext]) => [ext, type]),
);

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function isLocalArtwork(src: string): boolean {
  return src.startsWith(`${ARTWORK_ROUTE}/`);
}

export type ArtworkPlan =
  /** Nothing to do — no artwork, or already mirrored. */
  | { kind: "keep" }
  /** Write these bytes, then point the item at `src`. */
  | { kind: "store"; bytes: Buffer; repoPath: string; src: string; width?: number; height?: number }
  /** Un-storable upload — the save must be rejected, not silently degraded. */
  | { kind: "invalid"; reason: string };

/**
 * Decide what the artwork write should be, without writing anything. Fetching
 * and decoding happen here; the caller (saveItem) owns the commit so a failed
 * write stays retryable and a duplicate item never leaves an orphan image.
 */
export async function prepareArtwork(item: ContentItem): Promise<ArtworkPlan> {
  const src = item.artwork?.src;
  if (!src || isLocalArtwork(src)) return { kind: "keep" };

  let fetched: { bytes: Buffer; type: string } | null;
  if (src.startsWith("data:")) {
    fetched = decodeDataUrl(src);
    if (!fetched) return { kind: "invalid", reason: "artwork upload must be a jpeg/png/webp/gif/avif under 4 MB" };
  } else if (/^https?:\/\//.test(src)) {
    fetched = await fetchRemoteImage(src);
    if (!fetched) return { kind: "keep" }; // best-effort: keep the remote URL
  } else {
    return { kind: "keep" }; // not a shape we mirror
  }

  const stored = await toStoredImage(fetched.bytes, fetched.type);

  // Content-hashed filename: the URL changes iff the bytes change, so the
  // serving route can mark responses immutable and edits never serve stale art.
  const hash = createHash("sha256").update(stored.bytes).digest("hex").slice(0, 8);
  const rel = `${itemYear(item)}/${item.slug}-${hash}.${EXT_BY_TYPE[stored.type]}`;
  return {
    kind: "store",
    bytes: stored.bytes,
    repoPath: `${ARTWORK_DIR}/${rel}`,
    src: `${ARTWORK_ROUTE}/${rel}`,
    width: stored.width,
    height: stored.height,
  };
}

const MAX_STORED_EDGE = 1600;
const WEBP_QUALITY = 82;

/**
 * Normalize what actually lands in the repo: capped at 1600px and re-encoded
 * as WebP (~30% smaller than jpeg at the same visual quality — the repo grows
 * for every item ever added, so shaving bytes here compounds). GIFs pass
 * through untouched: a re-encode would freeze the animation. Conversion
 * failure falls back to the original bytes — never the reason a save dies.
 */
async function toStoredImage(
  bytes: Buffer,
  type: string,
): Promise<{ bytes: Buffer; type: string; width?: number; height?: number }> {
  if (type === "image/gif") return { bytes, type };
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(bytes)
      .rotate() // bake EXIF orientation in before the metadata is dropped
      .resize(MAX_STORED_EDGE, MAX_STORED_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, type: "image/webp", width: info.width, height: info.height };
  } catch {
    return { bytes, type };
  }
}

function decodeDataUrl(src: string): { bytes: Buffer; type: string } | null {
  const match = src.match(/^data:([a-z0-9/+.-]+);base64,([\s\S]*)$/i);
  if (!match) return null;
  const type = match[1].toLowerCase();
  if (!(type in EXT_BY_TYPE)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return { bytes, type };
}

async function fetchRemoteImage(src: string): Promise<{ bytes: Buffer; type: string } | null> {
  try {
    const got = await safeGet(src, "image/*");
    if (!got) return null;
    const type = (got.res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!(type in EXT_BY_TYPE)) return null;
    const bytes = await readCapped(got.res, MAX_IMAGE_BYTES, "reject");
    if (!bytes || bytes.length === 0) return null;
    return { bytes, type };
  } catch {
    return null;
  }
}
