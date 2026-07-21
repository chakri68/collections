import { NextResponse } from "next/server";
import { isOwner, sameOrigin } from "@/lib/auth/guard";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { toShareInput, resolveProvider } from "@/lib/content/registry/providers";
import { fetchUrlMetadata } from "@/lib/capture/metadata";

/**
 * Owner-only metadata enrichment (spec §12: server-side to avoid CORS + keep
 * credentials off the client). Given raw share text/url, it identifies the
 * provider, normalizes the source, and scrapes OG/Twitter metadata behind the
 * SSRF guard. Failure is non-fatal — the owner can always fill fields manually.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(`metadata:${clientKey(request)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  let raw: { title?: string; text?: string; url?: string };
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const share = toShareInput(raw);
  const adapter = await resolveProvider(share);
  const normalized = await adapter.normalize(share);

  // Provider adapter's own resolution first (deterministic bits: ids, thumbnails),
  // then the generic OG scrape to fill gaps. Adapter/user data wins on conflict.
  const adapterMeta = await adapter.resolveMetadata(normalized);
  const scraped = normalized.url ? await fetchUrlMetadata(normalized.url) : null;

  const merged = {
    provider: adapter.id,
    source: {
      url: normalized.url || undefined,
      canonicalUrl: normalized.canonicalUrl || undefined,
      providerId: normalized.providerId,
      embedUrl: normalized.embedUrl,
    },
    suggestedType: normalized.suggestedType ?? adapterMeta.suggestedType ?? scraped?.suggestedType ?? "website",
    title: adapterMeta.title ?? scraped?.title,
    subtitle: scraped?.subtitle,
    creator: adapterMeta.creator ?? scraped?.creator,
    description: adapterMeta.description ?? scraped?.description,
    artwork: adapterMeta.artwork ?? scraped?.artwork,
    metadata: adapterMeta.metadata,
    inferredFields: [
      ...new Set([...(adapterMeta.inferredFields ?? []), ...(scraped?.inferredFields ?? [])]),
    ],
  };

  // Spotify's og:description is "Artist · Album · Song · Year" — pull the artist
  // into creator so songs/albums aren't left uncredited.
  if (adapter.id === "spotify" && !merged.creator && merged.description?.includes(" · ")) {
    const artist = merged.description.split(" · ")[0]?.trim();
    if (artist) {
      merged.creator = artist;
      if (!merged.inferredFields.includes("creator")) merged.inferredFields.push("creator");
    }
  }

  return NextResponse.json(merged);
}
