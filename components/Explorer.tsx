"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);

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
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/item/${pick.slug}`);
  };

  // Count of applied facets (type only counts when it isn't the locked one).
  const activeCount =
    (type && type !== lockedType ? 1 : 0) + (mood ? 1 : 0) + (sort !== "recent" ? 1 : 0);

  const clear = () => {
    if (!lockedType) setType(null);
    setMood(null);
    setSort("recent");
  };

  // Re-key the results on facet/sort change so the container replays its
  // enter animation; typing in search updates in place (same key) with no
  // re-animation. Cheap, and keeps the route-level transition uninvolved.
  const resultsKey = `${type ?? ""}|${mood ?? ""}|${sort}`;

  const panelRef = useRef<HTMLDivElement>(null);
  useCloseOnOutside(open, panelRef, () => setOpen(false));

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

        <div className={styles.filterWrap} ref={panelRef}>
          <button
            className={`${styles.filterBtn} ${activeCount > 0 ? styles.filterActive : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            ▾ Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
          </button>

          {open && (
            <div className={styles.dropdown} role="group" aria-label="Filters">
              {!lockedType && types.length > 1 && (
                <div className={styles.group}>
                  <span className="label">Type</span>
                  <div className={styles.chips}>
                    <button className={`chip ${type === null ? "on" : ""}`} onClick={() => setType(null)}>All</button>
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
                </div>
              )}

              {moods.length > 0 && (
                <div className={styles.group}>
                  <span className="label">Mood</span>
                  <div className={styles.chips}>
                    <button className={`chip ${mood === null ? "on" : ""}`} onClick={() => setMood(null)}>Any</button>
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
                </div>
              )}

              <div className={styles.group}>
                <span className="label">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort order">
                  <option value="recent">Recently added</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title A–Z</option>
                </select>
              </div>

              {activeCount > 0 && (
                <button className={styles.clear} onClick={clear}>Clear filters</button>
              )}
            </div>
          )}
        </div>

        <span className={`${styles.count} tabular`}>
          {filtered.length} {filtered.length === 1 ? "thing" : "things"}
        </span>
        <button className="btn" onClick={random} disabled={filtered.length === 0}>
          ◆ Random
        </button>
      </div>

      <div key={resultsKey} className={styles.results}>
        <Grid items={filtered} />
      </div>
    </div>
  );
}

/** Close the dropdown on an outside click or Escape. */
function useCloseOnOutside(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onClose]);
}
