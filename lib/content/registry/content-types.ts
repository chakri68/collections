import type { ContentTypeDefinition } from "../types";

/**
 * The type registry drives display. Adding a type is a registry entry, not a
 * new component. Unknown types fall back to GENERIC_TYPE so the app never
 * breaks on data it doesn't recognize (spec §6.2).
 */

const registry = new Map<string, ContentTypeDefinition>();

export function registerContentType(def: ContentTypeDefinition): void {
  registry.set(def.id, def);
}

/** Safe default for any type not in the registry. */
export const GENERIC_TYPE: ContentTypeDefinition = {
  id: "generic",
  label: "Thing",
  pluralLabel: "Things",
  icon: "◆",
  defaultAspectRatio: "1 / 1",
  allowedLayouts: ["card"],
};

const DEFAULT_TYPES: ContentTypeDefinition[] = [
  { id: "song", label: "Song", pluralLabel: "Songs", icon: "♪", defaultAspectRatio: "1 / 1", allowedLayouts: ["card", "row"] },
  { id: "album", label: "Album", pluralLabel: "Albums", icon: "◉", defaultAspectRatio: "1 / 1", allowedLayouts: ["card"] },
  { id: "movie", label: "Movie", pluralLabel: "Movies", icon: "▶", defaultAspectRatio: "2 / 3", allowedLayouts: ["card"] },
  { id: "show", label: "Show", pluralLabel: "Shows", icon: "▦", defaultAspectRatio: "2 / 3", allowedLayouts: ["card"] },
  { id: "video", label: "Video", pluralLabel: "Videos", icon: "▷", defaultAspectRatio: "16 / 9", allowedLayouts: ["card"] },
  { id: "article", label: "Article", pluralLabel: "Articles", icon: "¶", defaultAspectRatio: "16 / 9", allowedLayouts: ["card", "row"] },
  { id: "book", label: "Book", pluralLabel: "Books", icon: "▤", defaultAspectRatio: "2 / 3", allowedLayouts: ["card"] },
  { id: "game", label: "Game", pluralLabel: "Games", icon: "◈", defaultAspectRatio: "16 / 9", allowedLayouts: ["card"] },
  { id: "website", label: "Website", pluralLabel: "Websites", icon: "⌘", defaultAspectRatio: "16 / 9", allowedLayouts: ["card", "row"] },
  { id: "note", label: "Note", pluralLabel: "Notes", icon: ">", defaultAspectRatio: "3 / 2", allowedLayouts: ["card", "row"] },
];

for (const def of DEFAULT_TYPES) registerContentType(def);

export function getContentType(id: string): ContentTypeDefinition {
  return registry.get(id) ?? { ...GENERIC_TYPE, id, label: id, pluralLabel: id };
}

export function isKnownType(id: string): boolean {
  return registry.has(id);
}

export function allContentTypes(): ContentTypeDefinition[] {
  return [...registry.values()];
}
