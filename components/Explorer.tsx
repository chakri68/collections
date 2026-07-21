"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/lib/content/types";
import { searchIndex, type SearchIndex } from "@/lib/content/search";
import { Grid } from "./Grid";
import styles from "./Explorer.module.css";

interface Facet {
  id: string;
  label: string;
}

interface ExplorerProps {
  items: ContentItem[];
  /** Prebuilt at static-generation time; the client only queries it. */
  index: SearchIndex;
  types: Facet[];
  moods: Facet[];
  /** Fix the type filter (used by the /type/[type] view) and hide the type row. */
  lockedType?: string;
}

type Sort = "recent" | "oldest" | "title";

function dateKey(item: ContentItem): string {
  return item.discoveredAt ?? item.publishedAt ?? item.createdAt;
}

export function Explorer({ items, index, types, moods, lockedType }: ExplorerProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | null>(lockedType ?? null);
  const [mood, setMood] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filtered = useMemo(() => {
    const passesFacets = (item: ContentItem) =>
      (!type || item.type === type) && (!mood || item.moods.includes(mood));

    const needle = q.trim();
    if (needle) {
      // Query present → order by search rank, then apply the facet filters.
      // Sort is intentionally ignored: relevance wins when the user is searching.
      return searchIndex(index, needle)
        .map((id) => byId.get(id))
        .filter((item): item is ContentItem => Boolean(item) && passesFacets(item!));
    }

    const out = items.filter(passesFacets);
    out.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const cmp = dateKey(a).localeCompare(dateKey(b));
      return sort === "oldest" ? cmp : -cmp;
    });
    return out;
  }, [items, byId, index, q, type, mood, sort]);

  const random = () => {
    // Random Thing, scoped to the current filters (spec §5.2).
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/item/${pick.slug}`);
  };

  return (
    <div>
      <div className={styles.bar}>
        <label className={styles.search}>
          <input
            type="search"
            placeholder="Search titles, creators, notes, tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the collection"
          />
        </label>
        <span className={`${styles.count} tabular`}>
          {filtered.length} {filtered.length === 1 ? "thing" : "things"}
        </span>
      </div>

      <div className={styles.facets}>
        {!lockedType && types.length > 1 && (
          <div className={styles.facetRow}>
            <span className={`${styles.facetLabel} label`}>Type</span>
            <button
              className={`chip ${type === null ? "on" : ""}`}
              onClick={() => setType(null)}
            >
              All
            </button>
            {types.map((t) => (
              <button
                key={t.id}
                className={`chip ${type === t.id ? "on" : ""}`}
                onClick={() => setType(type === t.id ? null : t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {moods.length > 0 && (
          <div className={styles.facetRow}>
            <span className={`${styles.facetLabel} label`}>Mood</span>
            <button
              className={`chip ${mood === null ? "on" : ""}`}
              onClick={() => setMood(null)}
            >
              Any
            </button>
            {moods.map((m) => (
              <button
                key={m.id}
                className={`chip ${mood === m.id ? "on" : ""}`}
                onClick={() => setMood(mood === m.id ? null : m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.controls}>
          <span className={`${styles.facetLabel} label`}>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort order">
            <option value="recent">Recently added</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
          <span className={styles.grow} />
          <button className="btn" onClick={random} disabled={filtered.length === 0}>
            ◆ Random thing
          </button>
        </div>
      </div>

      <Grid items={filtered} />
    </div>
  );
}
