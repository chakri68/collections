import "server-only";
import { cache } from "react";
import { createHash } from "node:crypto";
import {
  contentItemSchema,
  collectionSchema,
  tagSchema,
  moodSchema,
} from "./schema";
import type {
  ContentItem,
  Collection,
  Tag,
  Mood,
  ContentSnapshot,
  Manifest,
} from "./types";
import { readContentFiles, type ContentFile } from "./source";

function parseItem(file: ContentFile): ContentItem | null {
  try {
    const parsed = contentItemSchema.safeParse(JSON.parse(file.text));
    if (!parsed.success) {
      // Log and omit — one bad item must not trap the whole site (spec §10).
      console.warn(`[content] skipping invalid item ${file.path}:`, parsed.error.issues[0]?.message);
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.warn(`[content] skipping unreadable item ${file.path}:`, err);
    return null;
  }
}

function parseList<T>(
  file: ContentFile | undefined,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): T[] {
  if (!file) return [];
  try {
    const raw = JSON.parse(file.text);
    if (!Array.isArray(raw)) return [];
    const out: T[] = [];
    for (const entry of raw) {
      const parsed = schema.safeParse(entry);
      if (parsed.success && parsed.data !== undefined) out.push(parsed.data);
    }
    return out;
  } catch {
    return [];
  }
}

function buildManifest(items: ContentItem[]): Manifest {
  const counts: Record<string, number> = { total: items.length };
  for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;

  const hash = createHash("sha256")
    .update(JSON.stringify(items.map((i) => [i.id, i.updatedAt])))
    .digest("hex")
    .slice(0, 16);

  return {
    schemaVersion: 1,
    // Deterministic: derived from content, not wall-clock, so identical content
    // produces an identical manifest.
    snapshotVersion: hash,
    builtAt: process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : "",
    counts,
    typeRegistryVersion: "1",
    contentHash: hash,
  };
}

/**
 * Full snapshot including drafts/archived — server-only, for the owner/editor.
 * Wrapped in React cache() so it's computed once per render pass; freshness
 * across requests is governed by the content source (disk read in fs mode, the
 * tagged fetch cache in github mode).
 */
export const loadFullSnapshot = cache(async (): Promise<ContentSnapshot> => {
  const files = await readContentFiles();
  const byPath = new Map(files.map((f) => [f.path, f]));

  const items = files
    .filter((f) => f.path.startsWith("content/items/"))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(parseItem)
    .filter((i): i is ContentItem => i !== null);

  const collections = parseList<Collection>(byPath.get("content/collections.json"), collectionSchema);
  const tags = parseList<Tag>(byPath.get("content/tags.json"), tagSchema);
  const moods = parseList<Mood>(byPath.get("content/moods.json"), moodSchema);

  return { manifest: buildManifest(items), items, collections, tags, moods };
});

/** Public snapshot: published + unlisted only. Drafts and archived are dropped. */
export async function loadPublicSnapshot(): Promise<ContentSnapshot> {
  const full = await loadFullSnapshot();
  const items = full.items.filter(
    (i) => i.visibility === "published" || i.visibility === "unlisted",
  );
  const collections = full.collections.filter((c) => c.visibility !== "draft" && c.visibility !== "archived");
  return { ...full, manifest: buildManifest(items), items, collections };
}
