import type { ContentItem, ContentSnapshot } from "./types";

/** Timeline/recency date with the spec's fallback chain (§13). */
export function itemDate(item: ContentItem): string {
  return item.discoveredAt ?? item.publishedAt ?? item.createdAt;
}

export function byRecent(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => itemDate(b).localeCompare(itemDate(a)));
}

export function featured(snapshot: ContentSnapshot): ContentItem[] {
  return snapshot.items.filter((i) => i.featured);
}

export function pinned(snapshot: ContentSnapshot): ContentItem[] {
  return snapshot.items.filter((i) => i.pinned);
}

export function recentlyAdded(snapshot: ContentSnapshot, limit = 12): ContentItem[] {
  return byRecent(snapshot.items).slice(0, limit);
}

export function byType(snapshot: ContentSnapshot, type: string): ContentItem[] {
  return byRecent(snapshot.items.filter((i) => i.type === type));
}

export function bySlug(snapshot: ContentSnapshot, slug: string): ContentItem | undefined {
  return snapshot.items.find((i) => i.slug === slug);
}

export function byId(snapshot: ContentSnapshot, id: string): ContentItem | undefined {
  return snapshot.items.find((i) => i.id === id);
}

export function inCollection(snapshot: ContentSnapshot, collectionId: string): ContentItem[] {
  const collection = snapshot.collections.find((c) => c.id === collectionId || c.slug === collectionId);
  const members = snapshot.items.filter((i) => i.collections.includes(collection?.id ?? collectionId));
  if (!collection?.order) return byRecent(members);
  const order = collection.order;
  return [...members].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return itemDate(b).localeCompare(itemDate(a));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Types present in the collection, in registry-agnostic order (by count desc). */
export function typesPresent(snapshot: ContentSnapshot): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of snapshot.items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Related items: explicit relatedItemIds first, then shared collection, mood,
 * tags, and type similarity (spec §13). Deterministic — no randomness.
 */
export function related(snapshot: ContentSnapshot, item: ContentItem, limit = 6): ContentItem[] {
  const explicit = (item.relatedItemIds ?? [])
    .map((id) => byId(snapshot, id))
    .filter((x): x is ContentItem => Boolean(x));

  const explicitIds = new Set(explicit.map((i) => i.id));
  const scored = snapshot.items
    .filter((c) => c.id !== item.id && !explicitIds.has(c.id))
    .map((candidate) => ({ candidate, score: similarity(item, candidate) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || itemDate(b.candidate).localeCompare(itemDate(a.candidate)))
    .map((s) => s.candidate);

  return [...explicit, ...scored].slice(0, limit);
}

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0);
}

function similarity(a: ContentItem, b: ContentItem): number {
  return (
    overlap(a.collections, b.collections) * 4 +
    overlap(a.moods, b.moods) * 3 +
    overlap(a.tags, b.tags) * 2 +
    (a.type === b.type ? 1 : 0)
  );
}
