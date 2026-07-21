import type { ContentItem, ContentSnapshot } from "../content/types";
import type { CaptureInput, Duplicate } from "./types";
import { slugify, uniqueSlug } from "../text";

const SCHEMA_VERSION = 1;

/**
 * Turn trusted-but-unauthoritative capture input into a full ContentItem. The
 * server owns id, slug, schemaVersion, and timestamps — never the client.
 * `now` is injected so this stays pure and testable.
 */
export function buildContentItem(
  input: CaptureInput,
  snapshot: ContentSnapshot,
  now: string,
): ContentItem {
  const takenSlugs = new Set(snapshot.items.map((i) => i.slug));
  const takenIds = new Set(snapshot.items.map((i) => i.id));

  const baseSlug = slugify(input.title);
  const slug = uniqueSlug(baseSlug, takenSlugs);
  const id = uniqueSlug(baseSlug, takenIds);

  const published = input.visibility === "published";

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    slug,
    type: input.type,
    provider: input.provider,
    title: input.title,
    subtitle: input.subtitle,
    creator: input.creator,
    description: input.description,
    note: input.note,
    noteFormat: input.note ? input.noteFormat ?? "plain" : undefined,
    source: input.source,
    artwork: input.artwork,
    metadata: input.metadata,
    tags: input.tags,
    moods: input.moods,
    collections: input.collections,
    relatedItemIds: input.relatedItemIds,
    featured: input.featured,
    pinned: input.pinned,
    visibility: input.visibility,
    discoveredAt: input.discoveredAt,
    createdAt: now,
    updatedAt: now,
    publishedAt: published ? now : undefined,
  };
}

/** Apply an edit onto an existing item, preserving server-owned identity. */
export function applyEdit(existing: ContentItem, input: CaptureInput, now: string): ContentItem {
  const nowPublished = input.visibility === "published";
  return {
    ...existing,
    type: input.type,
    provider: input.provider,
    title: input.title,
    subtitle: input.subtitle,
    creator: input.creator,
    description: input.description,
    note: input.note,
    noteFormat: input.note ? input.noteFormat ?? "plain" : undefined,
    source: input.source,
    artwork: input.artwork,
    metadata: input.metadata,
    tags: input.tags,
    moods: input.moods,
    collections: input.collections,
    relatedItemIds: input.relatedItemIds,
    featured: input.featured,
    pinned: input.pinned,
    visibility: input.visibility,
    discoveredAt: input.discoveredAt ?? existing.discoveredAt,
    updatedAt: now,
    // First publish stamps publishedAt; later edits keep the original.
    publishedAt: existing.publishedAt ?? (nowPublished ? now : undefined),
  };
}

/**
 * Detect collisions before writing (spec §8.1 step 4). Checks the canonical
 * provider id, canonical URL, id, and slug against the existing collection.
 * `ignoreId` skips the item being edited so an edit doesn't conflict with itself.
 */
export function findDuplicates(
  candidate: Pick<ContentItem, "id" | "slug" | "source">,
  snapshot: ContentSnapshot,
  ignoreId?: string,
): Duplicate[] {
  const dupes: Duplicate[] = [];
  const providerId = candidate.source?.providerId;
  const canonical = candidate.source?.canonicalUrl ?? candidate.source?.url;

  for (const item of snapshot.items) {
    if (item.id === ignoreId) continue;
    const hit = (field: Duplicate["field"], value: string) =>
      dupes.push({
        field,
        value,
        existingId: item.id,
        existingSlug: item.slug,
        existingTitle: item.title,
      });

    if (providerId && item.source?.providerId === providerId) hit("providerId", providerId);
    else if (canonical && (item.source?.canonicalUrl ?? item.source?.url) === canonical) hit("canonicalUrl", canonical);
    if (item.id === candidate.id) hit("id", candidate.id);
    if (item.slug === candidate.slug) hit("slug", candidate.slug);
  }
  return dupes;
}
