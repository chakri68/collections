import type { ContentItem } from "./types";

/**
 * A lightweight, serializable search index built at build time (spec §13).
 * Pages are statically generated, so `buildSearchIndex` runs during the build
 * and the result is baked into the RSC payload — the client never re-derives it.
 *
 * Ranking is field-weighted token matching with prefix support. It's small and
 * dependency-free; if the collection ever outgrows it, the index shape is stable
 * enough to swap the matcher for a real engine without touching callers.
 */

/** Per-field weights — title matters most, raw metadata least (spec §13 order). */
const FIELD_WEIGHTS = {
  title: 10,
  creator: 6,
  subtitle: 5,
  tags: 5,
  collections: 4,
  moods: 4,
  description: 2,
  note: 2,
  metadata: 1,
} as const;

export interface SearchEntry {
  id: string;
  /** token → summed field weight for that token across the item. */
  tokens: Record<string, number>;
  /** Lowercased concatenation for multi-word phrase (substring) matching. */
  text: string;
}

export interface SearchIndex {
  entries: SearchEntry[];
}

const TOKEN_RE = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

function addField(tokens: Map<string, number>, text: string | undefined, weight: number): string {
  if (!text) return "";
  for (const tok of tokenize(text)) {
    tokens.set(tok, (tokens.get(tok) ?? 0) + weight);
  }
  return text.toLowerCase();
}

export function buildSearchIndex(items: ContentItem[]): SearchIndex {
  const entries = items.map<SearchEntry>((item) => {
    const tokens = new Map<string, number>();
    const parts: string[] = [];

    parts.push(addField(tokens, item.title, FIELD_WEIGHTS.title));
    parts.push(addField(tokens, item.creator, FIELD_WEIGHTS.creator));
    parts.push(addField(tokens, item.subtitle, FIELD_WEIGHTS.subtitle));
    parts.push(addField(tokens, item.description, FIELD_WEIGHTS.description));
    parts.push(addField(tokens, item.note, FIELD_WEIGHTS.note));
    for (const t of item.tags) parts.push(addField(tokens, t, FIELD_WEIGHTS.tags));
    for (const m of item.moods) parts.push(addField(tokens, m, FIELD_WEIGHTS.moods));
    for (const c of item.collections) parts.push(addField(tokens, c, FIELD_WEIGHTS.collections));
    for (const v of Object.values(item.metadata ?? {})) {
      if (v == null) continue;
      addField(tokens, Array.isArray(v) ? v.join(" ") : String(v), FIELD_WEIGHTS.metadata);
    }

    return { id: item.id, tokens: Object.fromEntries(tokens), text: parts.filter(Boolean).join(" ") };
  });

  return { entries };
}

/**
 * Rank ids for a query. AND semantics: every query term must prefix-match some
 * token in the doc. Score sums the best matching weight per term, with a phrase
 * bonus when the full query appears as a substring. Returns ids best-first.
 */
export function searchIndex(index: SearchIndex, query: string): string[] {
  const terms = tokenize(query);
  const phrase = query.trim().toLowerCase();
  if (terms.length === 0) return [];

  const scored: { id: string; score: number }[] = [];

  for (const entry of index.entries) {
    let total = 0;
    let allMatched = true;

    for (const term of terms) {
      let best = 0;
      for (const [tok, weight] of Object.entries(entry.tokens)) {
        if (tok === term) best = Math.max(best, weight * 2); // exact beats prefix
        else if (tok.startsWith(term)) best = Math.max(best, weight);
      }
      if (best === 0) {
        allMatched = false;
        break;
      }
      total += best;
    }

    if (!allMatched) continue;
    if (phrase.length > 2 && entry.text.includes(phrase)) total += 20; // phrase bonus
    scored.push({ id: entry.id, score: total });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.id);
}
