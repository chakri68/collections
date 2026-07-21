import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
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

const CONTENT_DIR = path.join(process.cwd(), "content");
const ITEMS_DIR = path.join(CONTENT_DIR, "items");

async function readJson(file: string): Promise<unknown> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

/** Recursively collect *.json under content/items. */
async function itemFiles(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await itemFiles(full)));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files.sort();
}

async function loadItems(): Promise<ContentItem[]> {
  const files = await itemFiles(ITEMS_DIR);
  const items: ContentItem[] = [];
  for (const file of files) {
    try {
      const parsed = contentItemSchema.safeParse(await readJson(file));
      if (!parsed.success) {
        // Log and omit — one bad item must not trap the whole site (spec §10).
        console.warn(`[content] skipping invalid item ${path.relative(CONTENT_DIR, file)}:`, parsed.error.issues[0]?.message);
        continue;
      }
      items.push(parsed.data);
    } catch (err) {
      console.warn(`[content] skipping unreadable item ${path.relative(CONTENT_DIR, file)}:`, err);
    }
  }
  return items;
}

async function loadList<T>(fileName: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): Promise<T[]> {
  try {
    const raw = await readJson(path.join(CONTENT_DIR, fileName));
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
    // rebuilds to an identical manifest (and cache stays valid).
    snapshotVersion: hash,
    builtAt: process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : "",
    counts,
    typeRegistryVersion: "1",
    contentHash: hash,
  };
}

let cached: Promise<ContentSnapshot> | null = null;

/** Full snapshot including drafts/archived — server-only, for the owner/editor. */
export function loadFullSnapshot(): Promise<ContentSnapshot> {
  if (cached) return cached;
  cached = (async () => {
    const [items, collections, tags, moods] = await Promise.all([
      loadItems(),
      loadList<Collection>("collections.json", collectionSchema),
      loadList<Tag>("tags.json", tagSchema),
      loadList<Mood>("moods.json", moodSchema),
    ]);
    return { manifest: buildManifest(items), items, collections, tags, moods };
  })();
  return cached;
}

/**
 * Drop the in-process cache so the next load re-reads disk. Called after a write
 * so the owner sees their change without a restart; the deployed static build
 * gets it on the next rebuild regardless.
 */
export function invalidateSnapshot(): void {
  cached = null;
}

/** Public snapshot: published + unlisted only. Drafts and archived are dropped. */
export async function loadPublicSnapshot(): Promise<ContentSnapshot> {
  const full = await loadFullSnapshot();
  const items = full.items.filter(
    (i) => i.visibility === "published" || i.visibility === "unlisted",
  );
  const collections = full.collections.filter((c) => c.visibility !== "draft" && c.visibility !== "archived");
  return { ...full, manifest: buildManifest(items), items, collections };
}
