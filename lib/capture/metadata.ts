import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import type { ResolvedMetadata } from "../content/types";

/**
 * Server-side metadata enrichment with SSRF defenses (spec §14):
 *  - only http/https
 *  - resolve the host and reject private/loopback/link-local IPs (incl. the
 *    cloud metadata endpoint 169.254.169.254)
 *  - follow redirects manually, re-validating every hop (a public URL must not
 *    be able to bounce us onto an internal one)
 *  - hard timeout + response size cap
 * Enrichment is a convenience; callers must treat failure as non-fatal.
 */

const MAX_BYTES = 1_000_000; // 1 MB of HTML is plenty for <head>
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;

function ipIsPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  if (v.startsWith("fe80")) return true; // link-local
  if (v.startsWith("::ffff:")) return ipIsPrivate(v.slice(7)); // v4-mapped
  return false;
}

function hostnameIsBlocked(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal");
}

/** Reject before connecting: bad protocol, blocked name, or private resolved IP. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
  if (hostnameIsBlocked(url.hostname)) throw new Error("blocked host");

  // If it's a literal IP, check directly; else resolve every address.
  if (net.isIP(url.hostname)) {
    if (ipIsPrivate(url.hostname)) throw new Error("private address");
  } else {
    const addrs = await lookup(url.hostname, { all: true });
    if (addrs.length === 0) throw new Error("unresolvable host");
    if (addrs.some((a) => ipIsPrivate(a.address))) throw new Error("resolves to private address");
  }
  return url;
}

async function safeFetchHtml(startUrl: string): Promise<{ url: string; html: string } | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current); // re-validate EVERY hop

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "CollectionBot/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("xml")) return null;

    // Read with a byte cap so a giant response can't exhaust memory.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        chunks.push(value.slice(0, value.length - (total - MAX_BYTES)));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { url: current, html: Buffer.concat(chunks).toString("utf8") };
  }
  return null; // too many redirects
}

// ── Extraction ──────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function metaContent(html: string, key: string, attr: "property" | "name"): string | undefined {
  // Match order-agnostic attribute placement for a given property/name.
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  if (!tag) return undefined;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content.trim()) : undefined;
}

function extract(html: string, finalUrl: string): ResolvedMetadata {
  const pick = (...vals: (string | undefined)[]) => vals.find((v) => v && v.length > 0);

  const title = pick(
    metaContent(html, "og:title", "property"),
    metaContent(html, "twitter:title", "name"),
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim(),
  );
  const description = pick(
    metaContent(html, "og:description", "property"),
    metaContent(html, "twitter:description", "name"),
    metaContent(html, "description", "name"),
  );
  const image = pick(
    metaContent(html, "og:image", "property"),
    metaContent(html, "twitter:image", "name"),
    metaContent(html, "twitter:image:src", "name"),
  );
  const siteName = metaContent(html, "og:site_name", "property");
  const ogType = metaContent(html, "og:type", "property");

  const inferred: string[] = [];
  const meta: ResolvedMetadata = { inferredFields: inferred };
  if (title) {
    meta.title = decodeEntities(title);
    inferred.push("title");
  }
  if (description) {
    meta.description = description;
    inferred.push("description");
  }
  if (siteName) meta.subtitle = siteName;
  if (image) {
    try {
      meta.artwork = { src: new URL(image, finalUrl).toString(), alt: title ?? "" };
      inferred.push("artwork");
    } catch {}
  }
  // og:type video.* / article → a type suggestion the user can override.
  if (ogType?.startsWith("video")) meta.suggestedType = "video";
  else if (ogType === "article") meta.suggestedType = "article";
  else if (ogType?.startsWith("book")) meta.suggestedType = "book";
  else if (ogType === "music.song") meta.suggestedType = "song";

  return meta;
}

/** Fetch and extract metadata for a URL. Returns null on any failure — never throws to the caller. */
export async function fetchUrlMetadata(url: string): Promise<ResolvedMetadata | null> {
  try {
    const doc = await safeFetchHtml(url);
    if (!doc) return null;
    return extract(doc.html, doc.url);
  } catch {
    return null;
  }
}
