import "server-only";
import { revalidateTag, revalidatePath } from "next/cache";
import { contentItemSchema } from "../content/schema";
import { loadFullSnapshot } from "../content/loader";
import { byId } from "../content/query";
import { buildContentItem, applyEdit, findDuplicates } from "./build-item";
import { defaultCommitter, commitMessage, type Committer } from "../git/committer";
import type { SaveRequest, SaveOutcome } from "./types";

/**
 * Idempotency cache (spec §8.2): a repeated tap / network retry carrying the
 * same key returns the first outcome instead of creating a second commit.
 * In-process, bounded; fine for a single-owner server.
 */
const idempotency = new Map<string, SaveOutcome>();
const IDEMPOTENCY_MAX = 500;

function remember(key: string, outcome: SaveOutcome): SaveOutcome {
  if (idempotency.size >= IDEMPOTENCY_MAX) {
    idempotency.delete(idempotency.keys().next().value as string);
  }
  idempotency.set(key, outcome);
  return outcome;
}

/**
 * The full write path. Trusts nothing from the client but the shape: identity,
 * timestamps, and dedupe are all derived server-side against the real snapshot.
 */
export async function saveItem(
  req: SaveRequest,
  committer: Committer = defaultCommitter(),
  now = new Date().toISOString(),
): Promise<SaveOutcome> {
  const cached = idempotency.get(req.idempotencyKey);
  if (cached) return cached;

  const snapshot = await loadFullSnapshot();
  const mode = req.editingId ? "update" : "create";

  let item;
  if (mode === "update") {
    const existing = byId(snapshot, req.editingId!);
    if (!existing) {
      return remember(req.idempotencyKey, { ok: false, error: "validation", issues: ["item not found"] });
    }
    // Conflict guard: the repo changed under the editor (spec §8.2).
    if (req.baseUpdatedAt && existing.updatedAt !== req.baseUpdatedAt) {
      return remember(req.idempotencyKey, { ok: false, error: "conflict", currentUpdatedAt: existing.updatedAt });
    }
    item = applyEdit(existing, req.input, now);
  } else {
    item = buildContentItem(req.input, snapshot, now);
  }

  // Final schema validation on the fully-formed item — the real gate (spec §14).
  const parsed = contentItemSchema.safeParse(item);
  if (!parsed.success) {
    return remember(req.idempotencyKey, {
      ok: false,
      error: "validation",
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  const dupes = findDuplicates(parsed.data, snapshot, req.editingId);
  if (dupes.length > 0) {
    return remember(req.idempotencyKey, { ok: false, error: "duplicate", duplicates: dupes });
  }

  try {
    const { commit, committed } = await committer.write(parsed.data, commitMessage(parsed.data, mode));
    // Purge the content cache so the change shows immediately — no rebuild
    // needed. Tag drops the source fetches (github mode); path revalidation
    // regenerates the affected pages.
    try {
      revalidateTag("content", "max");
      revalidatePath("/", "layout");
    } catch {
      // revalidate* throw outside a request scope (e.g. a unit test) — ignore.
    }
    return remember(req.idempotencyKey, {
      ok: true,
      id: parsed.data.id,
      slug: parsed.data.slug,
      commit,
      committed,
    });
  } catch (err) {
    // Write failures are NOT remembered — the client keeps a retryable draft
    // (spec §8.4) and a retry with the same key should be allowed to proceed.
    return { ok: false, error: "write_failed", message: err instanceof Error ? err.message : "unknown error" };
  }
}
