import type { ProviderAdapter, ShareInput, NormalizedSource, ResolvedMetadata, ContentItem } from "../../types";

/**
 * The no-URL provider. Plain text without any link becomes a standalone note
 * (spec §6.3). Never matches when a URL is present — a real provider should.
 */
export const manualAdapter: ProviderAdapter = {
  id: "manual",
  displayName: "Note",
  priority: -200,

  matches(input: ShareInput) {
    return input.urls.length === 0;
  },

  async normalize(): Promise<NormalizedSource> {
    return {
      provider: "manual",
      url: "",
      canonicalUrl: "",
      suggestedType: "note",
    };
  },

  async resolveMetadata(input: ShareInput | NormalizedSource): Promise<ResolvedMetadata> {
    const text = "text" in input ? input.text : undefined;
    const title = "title" in input ? input.title : undefined;
    return {
      title: title || (text ? firstLine(text) : undefined),
      description: text,
      suggestedType: "note",
      inferredFields: [],
    };
  },

  getOpenUrl(item: ContentItem): string {
    return item.source?.url ?? "";
  },
};

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim().slice(0, 80);
}
