import type { ProviderAdapter, ShareInput, NormalizedSource, ResolvedMetadata, ContentItem, EmbedDescriptor } from "../../types";
import { hostOf, stripTracking, safeParse } from "../../url";

/** Extract a video id from any of youtube.com/watch, youtu.be, /shorts, /embed. */
function parseVideoId(url: string): string | null {
  const u = safeParse(url);
  if (!u) return null;
  const host = hostOf(url);
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
  }
  return null;
}

export const youtubeAdapter: ProviderAdapter = {
  id: "youtube",
  displayName: "YouTube",
  priority: 100,

  matches(input: ShareInput) {
    return input.urls.some((u) => parseVideoId(u) !== null);
  },

  async normalize(input: ShareInput): Promise<NormalizedSource> {
    const raw = input.urls.find((u) => parseVideoId(u)) ?? input.urls[0];
    const id = parseVideoId(raw)!;
    return {
      provider: "youtube",
      url: stripTracking(raw),
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      providerId: id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      suggestedType: "video",
    };
  },

  async resolveMetadata(source: NormalizedSource): Promise<ResolvedMetadata> {
    // oEmbed enrichment is server-side; thumbnail URL is deterministic though.
    const id = source.providerId;
    const artwork = id
      ? { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "Video thumbnail" }
      : undefined;
    return { suggestedType: "video", artwork, inferredFields: artwork ? ["artwork"] : [] };
  },

  getEmbed(item: ContentItem): EmbedDescriptor | null {
    const embed = item.source?.embedUrl;
    if (!embed) return null;
    return {
      src: embed,
      title: `${item.title} — YouTube`,
      aspectRatio: "16 / 9",
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    };
  },

  getOpenUrl(item: ContentItem): string {
    return item.source?.canonicalUrl ?? item.source?.url ?? "https://youtube.com";
  },
};
