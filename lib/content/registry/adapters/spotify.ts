import type { ProviderAdapter, ShareInput, NormalizedSource, ResolvedMetadata, ContentItem, EmbedDescriptor } from "../../types";
import { hostOf, stripTracking, safeParse } from "../../url";

/** open.spotify.com/{kind}/{id} → kind maps to our content type. */
const KIND_TO_TYPE: Record<string, string> = {
  track: "song",
  album: "album",
  playlist: "album",
  episode: "video",
  show: "show",
  artist: "song",
};

function parse(url: string): { kind: string; id: string } | null {
  const u = safeParse(url);
  if (!u) return null;
  const host = hostOf(url);
  if (host !== "spotify.com" && host !== "open.spotify.com") return null;
  // /track/ID or /intl-xx/track/ID
  const m = u.pathname.match(/(?:\/intl-[a-z]{2})?\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  return { kind: m[1], id: m[2] };
}

export const spotifyAdapter: ProviderAdapter = {
  id: "spotify",
  displayName: "Spotify",
  priority: 100,

  matches(input: ShareInput) {
    return input.urls.some((u) => parse(u) !== null);
  },

  async normalize(input: ShareInput): Promise<NormalizedSource> {
    const raw = input.urls.find((u) => parse(u)) ?? input.urls[0];
    const p = parse(raw)!;
    const canonicalUrl = `https://open.spotify.com/${p.kind}/${p.id}`;
    return {
      provider: "spotify",
      url: stripTracking(raw),
      canonicalUrl,
      providerId: `${p.kind}:${p.id}`,
      embedUrl: `https://open.spotify.com/embed/${p.kind}/${p.id}`,
      suggestedType: KIND_TO_TYPE[p.kind] ?? "song",
    };
  },

  async resolveMetadata(source: NormalizedSource): Promise<ResolvedMetadata> {
    // Real enrichment happens server-side (oEmbed / Web API). Client build stays offline.
    return { suggestedType: source.suggestedType, inferredFields: [] };
  },

  getEmbed(item: ContentItem): EmbedDescriptor | null {
    const embed = item.source?.embedUrl;
    if (!embed) return null;
    // theme=0 is Spotify's dark embed — no white background against our theme.
    let src = embed;
    try {
      const url = new URL(embed);
      url.searchParams.set("theme", "0");
      src = url.toString();
    } catch {
      /* keep the raw embed if it somehow isn't a valid URL */
    }
    return {
      src,
      title: `${item.title} — Spotify`,
      // Spotify picks its layout by WIDTH: in a narrow frame the 152px "standard"
      // player collapses to the ~80px compact bar and leaves its white
      // background in the leftover height. The 80px compact player is the one
      // size that fills consistently at any width, so a track uses it; albums
      // and playlists need the taller list layout.
      height: item.type === "song" ? 80 : 352,
      allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
    };
  },

  getOpenUrl(item: ContentItem): string {
    return item.source?.canonicalUrl ?? item.source?.url ?? "https://open.spotify.com";
  },
};
