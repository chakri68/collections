import type {
  ProviderAdapter,
  ShareInput,
  NormalizedSource,
  ResolvedMetadata,
  ContentItem,
  EmbedDescriptor,
} from "../../types";
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
  const m = u.pathname.match(
    /(?:\/intl-[a-z]{2})?\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/,
  );
  if (!m) return null;
  return { kind: m[1], id: m[2] };
}

/**
 * `…/embed/track/ID` → `…/track/ID?theme=0`.
 *
 * The IFrame API's createController throws "Invalid URI" on an /embed/ URL — it
 * takes the canonical page URL and builds the embed URL itself. It does carry
 * the query string over, which is how theme=0 survives the round trip.
 */
function controllerUrl(embedUrl: string): string | null {
  const url = safeParse(embedUrl);
  if (!url) return null;
  url.pathname = url.pathname.replace(/^\/embed(?=\/|$)/, "");
  return url.toString();
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
    const controller = controllerUrl(embed);
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
      // A track player snaps to one of four fixed layouts — 80 (compact bar),
      // 152, 232, 352 — and pads whatever height is left over with its own
      // background. Ask for 320 and you get the 280-ish card plus 40px of
      // filler. So a track must use a band exactly; 352 is the largest.
      // Albums and playlists are a scrolling list, which fills any tall frame.
      height: item.type === "song" ? 352 : 640,
      allow:
        "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
      // Spotify ships an IFrame API, so the player is driven through a
      // controller rather than dropped in as a sealed frame (see SpotifyEmbed).
      controller: controller ? { kind: "spotify", url: controller } : undefined,
    };
  },

  getOpenUrl(item: ContentItem): string {
    return (
      item.source?.canonicalUrl ??
      item.source?.url ??
      "https://open.spotify.com"
    );
  },
};
