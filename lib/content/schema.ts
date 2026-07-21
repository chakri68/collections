import { z } from "zod";

/**
 * The runtime schema is the source of truth. TS types are inferred from it
 * (see ./types.ts), and the same schema validates every item file at build
 * time and every write on the server. One definition, no drift.
 */

export const VISIBILITY = ["draft", "unlisted", "published", "archived"] as const;
export const NOTE_FORMAT = ["plain", "markdown"] as const;

/** Loose scalar bag for provider-specific fields. Core UI must tolerate absence. */
const metadataValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const sourceSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  providerId: z.string().optional(),
  embedUrl: z.string().url().optional(),
});

export const artworkSchema = z.object({
  src: z.string(),
  alt: z.string(),
  dominantColor: z.string().optional(),
  blurhash: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  attribution: z.string().optional(),
});

export const contentItemSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  type: z.string().min(1),
  provider: z.string().min(1),

  title: z.string().min(1),
  subtitle: z.string().optional(),
  creator: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
  noteFormat: z.enum(NOTE_FORMAT).optional(),

  source: sourceSchema.optional(),
  artwork: artworkSchema.optional(),

  metadata: z.record(z.string(), metadataValue).optional(),
  tags: z.array(z.string()).default([]),
  moods: z.array(z.string()).default([]),
  collections: z.array(z.string()).default([]),
  relatedItemIds: z.array(z.string()).optional(),

  featured: z.boolean().optional(),
  pinned: z.boolean().optional(),
  rank: z.number().optional(),
  visibility: z.enum(VISIBILITY),

  discoveredAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().optional(),
});

/** Editorial grouping. */
export const collectionSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  title: z.string().min(1),
  description: z.string().optional(),
  artwork: artworkSchema.optional(),
  /** Explicit item order; ids not listed sort after, by item rank/date. */
  order: z.array(z.string()).optional(),
  visibility: z.enum(VISIBILITY).default("published"),
  rank: z.number().optional(),
});

export const tagSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const moodSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

/** Snapshot descriptor the client uses to decide if cached content is stale. */
export const manifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  snapshotVersion: z.string(),
  builtAt: z.string(),
  counts: z.record(z.string(), z.number()),
  typeRegistryVersion: z.string(),
  contentHash: z.string(),
});

export type ContentItemInput = z.input<typeof contentItemSchema>;
