import type { ProviderAdapter, ShareInput } from "../types";
import { extractUrls } from "../url";
import { spotifyAdapter } from "./adapters/spotify";
import { youtubeAdapter } from "./adapters/youtube";
import { webAdapter } from "./adapters/web";
import { manualAdapter } from "./adapters/manual";

/**
 * One registry. A new provider = one adapter module + one entry here (spec §6).
 * Resolution is priority-ordered so specialised adapters win over the generic
 * web fallback, which wins over the manual/no-URL adapter.
 */
const adapters: ProviderAdapter[] = [
  spotifyAdapter,
  youtubeAdapter,
  webAdapter,
  manualAdapter,
];

export function registerProvider(adapter: ProviderAdapter): void {
  adapters.push(adapter);
}

export function getProvider(id: string): ProviderAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

export function allProviders(): ProviderAdapter[] {
  return [...adapters];
}

/** Build a ShareInput from raw share-sheet fields, extracting every candidate URL. */
export function toShareInput(raw: { title?: string; text?: string; url?: string }): ShareInput {
  // Share Target often puts the URL inside `text` rather than `url` (spec §9).
  const urls = extractUrls(raw.url, raw.text, raw.title);
  return { title: raw.title, text: raw.text, url: raw.url, urls };
}

/** Highest-priority adapter whose matches() returns true. Always resolves (manual is the floor). */
export async function resolveProvider(input: ShareInput): Promise<ProviderAdapter> {
  const ranked = [...adapters].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const adapter of ranked) {
    if (await adapter.matches(input)) return adapter;
  }
  return manualAdapter;
}
