"use client";

import { useId, useMemo, useRef, useState } from "react";
import styles from "./owner.module.css";

export interface TaxonomyOption {
  id: string;
  label: string;
}

/** Kinds the /api/taxonomy endpoint knows how to append to. */
export type TaxonomyKind = "mood" | "collection" | "tag";

/**
 * Past this many options a flat chip list stops being scannable, so the field
 * switches to a filter box. Both modes select the same way — the difference is
 * only how you find the thing.
 */
const SEARCH_THRESHOLD = 10;

interface TaxonomyFieldProps {
  label: string;
  kind: TaxonomyKind;
  options: TaxonomyOption[];
  selected: string[];
  onToggle: (id: string) => void;
  /** Fired after the server commits a new entry, so the parent can list and select it. */
  onCreated: (option: TaxonomyOption) => void;
}

export function TaxonomyField({ label, kind, options, selected, onToggle, onCreated }: TaxonomyFieldProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ids already on the item that aren't in the index (hand-written tags from
  // before, an entry deleted since) still have to render and be removable.
  const all = useMemo(() => {
    const known = new Set(options.map((o) => o.id));
    return [...options, ...selected.filter((s) => !known.has(s)).map((id) => ({ id, label: id }))];
  }, [options, selected]);

  const searchable = all.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? all.filter((o) => o.label.toLowerCase().includes(q) || o.id.includes(q)) : all),
    [all, q],
  );
  // Offer creation straight from the box when what you typed isn't already there.
  const createFromQuery = q.length > 0 && !all.some((o) => o.label.toLowerCase() === q || o.id === q);
  const rowCount = matches.length + (createFromQuery ? 1 : 0);
  const activeRow = Math.min(active, Math.max(0, rowCount - 1));

  async function create(text: string) {
    const name = text.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/taxonomy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, label: name }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) {
        setError(out?.issues?.join("; ") ?? out?.message ?? `Couldn't add that ${kind}.`);
        return;
      }
      onCreated({ id: out.id, label: out.label });
      setQuery("");
      setDraft("");
      setDrafting(false);
      setOpen(false);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function pick(id: string) {
    onToggle(id);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (rowCount === 0) return;
      setActive((a) => (Math.min(a, rowCount - 1) + (e.key === "ArrowDown" ? 1 : rowCount - 1)) % rowCount);
      return;
    }
    if (e.key === "Enter") {
      // Never let the picker submit the capture form.
      e.preventDefault();
      if (createFromQuery && activeRow === matches.length) return void create(query);
      const option = matches[activeRow];
      if (option) pick(option.id);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className={styles.field}>
      <div className={styles.pickerHead}>
        <span className="label">{label}</span>
        <span className={styles.pickerCount}>
          {selected.length > 0 ? `${selected.length} selected` : `${all.length} available`}
        </span>
        <span className={styles.spacer} />
        <button type="button" className={styles.miniBtn} onClick={() => setDrafting((d) => !d)}>
          {drafting ? "Cancel" : `+ New ${kind}`}
        </button>
      </div>

      {searchable ? (
        <>
          {selected.length > 0 && (
            <div className={styles.suggest}>
              {selected.map((id) => (
                <button type="button" key={id} className="chip on" onClick={() => onToggle(id)}>
                  {all.find((o) => o.id === id)?.label ?? id} ×
                </button>
              ))}
            </div>
          )}

          <div className={styles.picker}>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              value={query}
              placeholder={`Search ${label.toLowerCase()}…`}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
            />

            {open && (
              // Mousedown on the list would blur the input and unmount the list
              // before the click landed. Suppress it; the click still fires.
              <div className={styles.results} id={listId} role="listbox" onMouseDown={(e) => e.preventDefault()}>
                {matches.map((o, i) => {
                  const on = selected.includes(o.id);
                  return (
                    <button
                      type="button"
                      key={o.id}
                      role="option"
                      aria-selected={on}
                      className={`${styles.result} ${i === activeRow ? styles.resultActive : ""} ${on ? styles.resultOn : ""}`}
                      onClick={() => pick(o.id)}
                    >
                      <span className={styles.resultMark} aria-hidden>{on ? "×" : "+"}</span>
                      {o.label}
                    </button>
                  );
                })}

                {createFromQuery && (
                  <button
                    type="button"
                    className={`${styles.result} ${activeRow === matches.length ? styles.resultActive : ""}`}
                    onClick={() => create(query)}
                    disabled={busy}
                  >
                    <span className={styles.resultMark} aria-hidden>+</span>
                    {busy ? "Adding…" : `Create “${query.trim()}”`}
                  </button>
                )}

                {rowCount === 0 && <div className={styles.resultEmpty}>No match.</div>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.suggest}>
          {all.map((o) => (
            <button
              type="button"
              key={o.id}
              className={`chip ${selected.includes(o.id) ? "on" : ""}`}
              onClick={() => onToggle(o.id)}
            >
              {o.label}
            </button>
          ))}
          {all.length === 0 && <span className={styles.pickerCount}>None yet.</span>}
        </div>
      )}

      {drafting && (
        <div className={styles.newRow}>
          <input
            type="text"
            autoFocus
            value={draft}
            placeholder={`New ${kind} name`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create(draft);
              }
            }}
          />
          <button type="button" className="btn" disabled={busy || !draft.trim()} onClick={() => create(draft)}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
