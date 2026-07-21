import { z } from "zod";
import { artworkSchema, sourceSchema, VISIBILITY, NOTE_FORMAT } from "../content/schema";

/**
 * What the review form submits. It's the ContentItem minus the fields the
 * server owns (id, slug, schemaVersion, timestamps) — those are never trusted
 * from the client. The server derives them in buildContentItem.
 */
export const captureInputSchema = z.object({
  type: z.string().min(1),
  provider: z.string().min(1),
  title: z.string().min(1).max(300),
  subtitle: z.string().max(300).optional(),
  creator: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  note: z.string().max(8000).optional(),
  noteFormat: z.enum(NOTE_FORMAT).optional(),
  source: sourceSchema.optional(),
  artwork: artworkSchema.optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])).optional(),
  tags: z.array(z.string().max(60)).max(30).default([]),
  moods: z.array(z.string().max(60)).max(20).default([]),
  collections: z.array(z.string().max(80)).max(20).default([]),
  relatedItemIds: z.array(z.string()).max(30).optional(),
  featured: z.boolean().optional(),
  pinned: z.boolean().optional(),
  visibility: z.enum(VISIBILITY).default("published"),
  discoveredAt: z.string().optional(),
});

export type CaptureInput = z.infer<typeof captureInputSchema>;

/** Edits carry the base version so the server can detect concurrent writes (spec §8.2). */
export const saveRequestSchema = z.object({
  input: captureInputSchema,
  /** Present on edit; absent on create. The item id being edited. */
  editingId: z.string().optional(),
  /** The updatedAt the editor loaded — conflict guard on edit. */
  baseUpdatedAt: z.string().optional(),
  /** De-dupes double-submits / retries into one commit (spec §8.2). */
  idempotencyKey: z.string().min(8).max(200),
});

export type SaveRequest = z.infer<typeof saveRequestSchema>;

export interface Duplicate {
  field: "providerId" | "canonicalUrl" | "id" | "slug";
  value: string;
  existingId: string;
  existingSlug: string;
  existingTitle: string;
}

export type SaveOutcome =
  | { ok: true; id: string; slug: string; commit: string; committed: boolean }
  | { ok: false; error: "duplicate"; duplicates: Duplicate[] }
  | { ok: false; error: "conflict"; currentUpdatedAt: string }
  | { ok: false; error: "validation"; issues: string[] }
  | { ok: false; error: "write_failed"; message: string };
