import type { z } from "zod";
import type {
  artworkSchema,
  collectionSchema,
  contentItemSchema,
  manifestSchema,
  moodSchema,
  sourceSchema,
  tagSchema,
} from "./schema";

/** The normalized shape the whole app operates on. No provider branches leak past this. */
export type ContentItem = z.infer<typeof contentItemSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Artwork = z.infer<typeof artworkSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Mood = z.infer<typeof moodSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export type Visibility = ContentItem["visibility"];

/** The aggregate the build emits and the client reads. */
export interface ContentSnapshot {
  manifest: Manifest;
  items: ContentItem[];
  collections: Collection[];
  tags: Tag[];
  moods: Mood[];
}

// ── Provider adapter contract (spec §6.1) ────────────────────────────────────

/** Raw payload arriving from a share sheet / paste / Add form. */
export interface ShareInput {
  title?: string;
  text?: string;
  url?: string;
  /** Every candidate URL extracted from the payload, in priority order. */
  urls: string[];
}

export interface NormalizedSource {
  provider: string;
  url: string;
  canonicalUrl: string;
  /** Canonical provider id, e.g. a Spotify track id or YouTube video id. */
  providerId?: string;
  embedUrl?: string;
  /** Best-guess type before metadata resolution; user can override. */
  suggestedType?: string;
}

export interface ResolvedMetadata {
  title?: string;
  subtitle?: string;
  creator?: string;
  description?: string;
  artwork?: Artwork;
  metadata?: ContentItem["metadata"];
  suggestedType?: string;
  /** Which fields were inferred vs. user-supplied, for the capture preview. */
  inferredFields?: string[];
}

export interface EmbedDescriptor {
  /** Allowlisted, provider-generated embed origin + path. */
  src: string;
  title: string;
  aspectRatio?: string;
  allow?: string;
}

export interface ProviderAdapter {
  id: string;
  displayName: string;
  priority?: number;

  matches(input: ShareInput): boolean | Promise<boolean>;
  normalize(input: ShareInput): Promise<NormalizedSource>;
  resolveMetadata(source: NormalizedSource): Promise<ResolvedMetadata>;
  getEmbed?(item: ContentItem): EmbedDescriptor | null;
  getOpenUrl(item: ContentItem): string;
}

// ── Content type registry (spec §6.2) ────────────────────────────────────────

export interface FieldDefinition {
  key: string;
  label: string;
  kind: "text" | "number" | "boolean" | "date" | "tags";
}

export interface ContentTypeDefinition {
  id: string;
  label: string;
  pluralLabel: string;
  /** Emoji or short glyph; kept as a string so registry stays declarative. */
  icon: string;
  defaultAspectRatio: string;
  allowedLayouts: string[];
  metadataFields?: FieldDefinition[];
}
