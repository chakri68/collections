import type { ProviderAdapter, ShareInput, NormalizedSource, ResolvedMetadata, ContentItem } from "../../types";
import { hostOf, stripTracking } from "../../url";

/**
 * Generic fallback. matches() is always true so it wins when nothing specialised
 * claims the input — but its priority is the lowest, so the registry only reaches
 * it last (spec §6.3). No embed; just a link card + Open Original.
 */
export const webAdapter: ProviderAdapter = {
  id: "web",
  displayName: "Web",
  priority: -100,

  matches(input: ShareInput) {
    return input.urls.length > 0;
  },

  async normalize(input: ShareInput): Promise<NormalizedSource> {
    const raw = input.urls[0];
    return {
      provider: "web",
      url: raw,
      canonicalUrl: stripTracking(raw),
      suggestedType: "website",
    };
  },

  async resolveMetadata(source: NormalizedSource): Promise<ResolvedMetadata> {
    // Server-side OG/Twitter/JSON-LD scrape fills this in. Offline, we at least
    // have the domain as a title fallback.
    const host = hostOf(source.canonicalUrl);
    return {
      title: host || undefined,
      suggestedType: "website",
      inferredFields: host ? ["title"] : [],
    };
  },

  getOpenUrl(item: ContentItem): string {
    return item.source?.canonicalUrl ?? item.source?.url ?? "#";
  },
};
