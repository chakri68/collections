import "server-only";
import { revalidateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { collectionSchema, tagSchema, moodSchema } from "../content/schema";
import { readContentFiles } from "../content/source";
import { slugify, uniqueSlug } from "../text";
import { defaultCommitter, serialize, type Committer } from "../git/committer";

/**
 * Creating taxonomy entries (a mood, a collection, a tag) from the capture
 * form. Same shape as the item write path: derive identity server-side, commit
 * the file, purge the content cache.
 *
 * These files are small, hand-editable indexes, so a write re-serializes the
 * whole array rather than patching text — the diff stays readable and the
 * result is always valid JSON.
 */

export const TAXONOMY_KINDS = ["mood", "collection", "tag"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export const createTaxonomySchema = z.object({
  kind: z.enum(TAXONOMY_KINDS),
  label: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
});

export type CreateTaxonomyRequest = z.infer<typeof createTaxonomySchema>;

export type TaxonomyOutcome =
  | {
      ok: true;
      kind: TaxonomyKind;
      id: string;
      label: string;
      /** True when an equivalent entry already existed — nothing was written. */
      existing: boolean;
      commit: string;
      committed: boolean;
    }
  | { ok: false; error: "validation"; issues: string[] }
  | { ok: false; error: "write_failed"; message: string };

interface KindConfig {
  path: string;
  schema: z.ZodType;
  /** Where the human-readable name lives — `title` for collections, `label` elsewhere. */
  nameKey: "label" | "title";
}

const KINDS: Record<TaxonomyKind, KindConfig> = {
  mood: { path: "content/moods.json", schema: moodSchema, nameKey: "label" },
  tag: { path: "content/tags.json", schema: tagSchema, nameKey: "label" },
  collection: { path: "content/collections.json", schema: collectionSchema, nameKey: "title" },
};

type Entry = Record<string, unknown>;

/**
 * Read the index as raw JSON rather than through the loader. The loader hands
 * back schema-parsed entries, which would silently drop anything the schema
 * doesn't model and stamp defaults onto every neighbouring entry the moment we
 * write the array back.
 */
async function readList(repoPath: string): Promise<Entry[]> {
  const file = (await readContentFiles()).find((f) => f.path === repoPath);
  if (!file) return [];
  const raw = JSON.parse(file.text);
  return Array.isArray(raw) ? (raw as Entry[]) : [];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function nextRank(list: Entry[]): number {
  const ranks = list.map((e) => (typeof e.rank === "number" ? e.rank : 0));
  return (ranks.length ? Math.max(...ranks) : 0) + 1;
}

export async function createTaxonomyEntry(
  req: CreateTaxonomyRequest,
  committer: Committer = defaultCommitter(),
): Promise<TaxonomyOutcome> {
  const { kind, description } = req;
  const label = req.label.trim();
  const config = KINDS[kind];

  let list: Entry[];
  try {
    list = await readList(config.path);
  } catch {
    return {
      ok: false,
      error: "validation",
      issues: [`${config.path} isn't valid JSON — fix it by hand before adding more.`],
    };
  }

  const id = slugify(label);
  if (!id) {
    return { ok: false, error: "validation", issues: ["label needs at least one letter or number"] };
  }

  // An entry that already exists is returned as-is instead of appended again.
  // That makes a double-tap (or two people racing the same name) a no-op rather
  // than a near-duplicate, and gives the caller the id it was going to get.
  const existing = list.find(
    (e) =>
      str(e.id) === id ||
      str(e[config.nameKey]).toLowerCase() === label.toLowerCase(),
  );
  if (existing) {
    return {
      ok: true,
      kind,
      id: str(existing.id),
      label: str(existing[config.nameKey]) || str(existing.id),
      existing: true,
      commit: "",
      committed: false,
    };
  }

  const entry: Entry =
    kind === "collection"
      ? {
          id,
          slug: uniqueSlug(id, new Set(list.map((e) => str(e.slug)))),
          title: label,
          ...(description ? { description } : {}),
          visibility: "published",
          rank: nextRank(list),
        }
      : { id, label, ...(description ? { description } : {}) };

  const parsed = config.schema.safeParse(entry);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  try {
    const { commit, committed } = await committer.writeFile(
      config.path,
      serialize([...list, entry]),
      `content: add ${kind} ${label}`,
    );
    try {
      revalidateTag("content", "max");
      revalidatePath("/", "layout");
    } catch {
      // revalidate* throw outside a request scope (e.g. a unit test) — ignore.
    }
    return { ok: true, kind, id, label, existing: false, commit, committed };
  } catch (err) {
    return {
      ok: false,
      error: "write_failed",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
}
