"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaptureInput, SaveOutcome } from "@/lib/capture/types";
import styles from "./owner.module.css";

export interface CapturePrefill extends Partial<CaptureInput> {
  artworkAlt?: string;
}

interface Option {
  id: string;
  label: string;
}

interface CaptureFormProps {
  mode: "create" | "edit";
  prefill: CapturePrefill;
  editingId?: string;
  baseUpdatedAt?: string;
  /** Raw share payload — enrichment source on create. */
  rawShare?: { title?: string; text?: string; url?: string };
  types: Option[];
  moods: Option[];
  collections: Option[];
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; slug: string; committed: boolean; commit: string }
  | { kind: "error"; outcome: SaveOutcome | null; message: string };

const DRAFT_PREFIX = "collection:capture-draft:";
const csv = (arr?: string[]) => (arr ?? []).join(", ");
const parseCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/**
 * A distinct draft slot per capture context. Keying every new capture as "new"
 * let an old blank draft clobber a fresh share (e.g. a Spotify link inheriting a
 * previous note's type). Keying by the shared URL/text isolates them and still
 * restores the right draft when the same thing is shared again.
 */
function shareSignature(share?: { url?: string; text?: string }): string {
  if (share?.url) return `url:${share.url}`;
  if (share?.text) return `text:${share.text.slice(0, 80)}`;
  return "blank";
}

export function CaptureForm({ mode, prefill, editingId, baseUpdatedAt, rawShare, types, moods, collections }: CaptureFormProps) {
  const router = useRouter();
  const draftId = editingId ?? shareSignature(rawShare);
  const draftKey = DRAFT_PREFIX + draftId;

  // One idempotency key per form instance — retries of the same submission
  // collapse to one commit; a fresh mount starts a fresh key. Lazy init runs
  // once; it's never rendered, so a differing SSR/client value is harmless.
  const [idemKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `k-${Date.now()}-${Math.random()}`,
  );

  const [form, setForm] = useState<CaptureInput>(() => normalize(prefill));
  // Tags are edited as raw text so a comma survives being typed. Parsing back to
  // form.tags on every keystroke (via join/split) would strip the trailing
  // comma the instant you type it, making a second tag impossible.
  const [tagsText, setTagsText] = useState(() => csv(normalize(prefill).tags));
  // Which fields were auto-filled by enrichment — so the owner knows to verify
  // them. Starts empty; only enrichment adds to it.
  const [inferred, setInferred] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [detecting, setDetecting] = useState(false);
  const enriched = useRef(false);
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore a saved draft on mount (create mode only) so a failed/interrupted
  // capture survives a reload (spec §8.4).
  useEffect(() => {
    if (mode !== "create") return;
    try {
      const saved = localStorage.getItem(draftKey);
      // Restore must happen in an effect, not a lazy initializer: localStorage
      // isn't available during the server render, and reading it at init would
      // desync hydration.
      if (saved) {
        const draft = JSON.parse(saved) as CaptureInput;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(draft);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTagsText(csv(draft.tags));
      }
    } catch {}
  }, [mode, draftKey]);

  // Autosave draft on every change.
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {}
  }, [form, draftKey]);

  // Server-side provider detection + OG scrape. Fills only empty fields; user
  // edits always win (mergeMeta). Shared by the share-target mount and the
  // manual "paste a link" path.
  const enrich = useCallback(async (payload: { url?: string; text?: string; title?: string }) => {
    if (!payload.url && !payload.text) return;
    setDetecting(true);
    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const meta = await res.json();
      setForm((prev) => mergeMeta(prev, meta));
      setInferred((prev) => new Set([...prev, ...(meta.inferredFields ?? [])]));
    } catch {
      // Enrichment is best-effort; the owner can fill fields by hand.
    } finally {
      setDetecting(false);
    }
  }, []);

  // Enrich once on mount from a share-target payload. enrich() sets state as it
  // fetches — deliberate here (it's the initial data load, not a render loop).
  useEffect(() => {
    if (mode !== "create" || enriched.current) return;
    if (!rawShare?.url && !rawShare?.text) return;
    enriched.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    enrich(rawShare);
  }, [mode, rawShare, enrich]);

  // Manual "paste a link": update the source URL immediately, then debounce an
  // enrich so we don't fetch on every keystroke.
  const onLink = (url: string) => {
    setForm((f) => ({ ...f, source: url ? { ...(f.source ?? {}), url } : undefined }));
    if (linkTimer.current) clearTimeout(linkTimer.current);
    const trimmed = url.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(trimmed)) return;
    linkTimer.current = setTimeout(() => enrich({ url: trimmed }), 600);
  };

  const set = <K extends keyof CaptureInput>(key: K, value: CaptureInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleIn = (key: "moods" | "collections" | "tags", id: string) =>
    setForm((f) => {
      const has = f[key].includes(id);
      return { ...f, [key]: has ? f[key].filter((x) => x !== id) : [...f[key], id] };
    });

  const canSubmit = form.title.trim().length > 0 && form.type && status.kind !== "saving";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: form, editingId, baseUpdatedAt, idempotencyKey: idemKey }),
      });
      const outcome: SaveOutcome = await res.json().catch(() => null);
      if (res.status === 201 && outcome?.ok) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        setStatus({ kind: "saved", slug: outcome.slug, committed: outcome.committed, commit: outcome.commit });
        router.refresh();
        return;
      }
      setStatus({ kind: "error", outcome, message: describe(outcome, res.status) });
    } catch {
      // Network failure — the draft is retained; the same idempotency key makes
      // a retry safe.
      setStatus({ kind: "error", outcome: null, message: "Network error — your draft is saved. Retry when you're back online." });
    }
  }

  return (
    <form onSubmit={submit} className={styles.capture}>
      <div className={styles.stack}>
        {mode === "create" && (
          <label className={styles.field}>
            <span className="label">
              Paste a link{" "}
              {detecting ? (
                <span className={styles.inferredTag}>· detecting…</span>
              ) : form.provider && form.provider !== "manual" && form.provider !== "web" ? (
                <span className={styles.inferredTag}>· {form.provider}</span>
              ) : null}
            </span>
            <input
              type="url"
              inputMode="url"
              value={form.source?.url ?? ""}
              onChange={(e) => onLink(e.target.value)}
              placeholder="https://…  (Spotify, YouTube, a link — or leave blank for a note)"
              aria-label="Paste a link"
            />
          </label>
        )}

        <FieldText label="Title" value={form.title} inferred={inferred.has("title")}
          onChange={(v) => set("title", v)} autoFocus={mode === "edit"} required />

        <div className={styles.row}>
          <label className={styles.field}>
            <span className="label">Type</span>
            <select value={form.type} onChange={(e) => set("type", e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
              {!types.some((t) => t.id === form.type) && form.type && (
                <option value={form.type}>{form.type}</option>
              )}
            </select>
          </label>
          <FieldText label="Creator" value={form.creator ?? ""} inferred={inferred.has("creator")}
            onChange={(v) => set("creator", v || undefined)} />
        </div>

        <label className={styles.field}>
          <span className="label">
            Note {form.noteFormat === "markdown" ? "(markdown)" : ""}
          </span>
          <textarea rows={4} value={form.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)}
            placeholder="Why did you keep this?" />
          <label className={styles.check} style={{ marginTop: 4 }}>
            <input type="checkbox" checked={form.noteFormat === "markdown"}
              onChange={(e) => set("noteFormat", e.target.checked ? "markdown" : "plain")} />
            <span>Markdown</span>
          </label>
        </label>

        <FieldText label="Tags (comma separated)" value={tagsText}
          onChange={(v) => { setTagsText(v); set("tags", parseCsv(v)); }} />

        <ChipField label="Moods" options={moods} selected={form.moods} onToggle={(id) => toggleIn("moods", id)} />
        <ChipField label="Collections" options={collections} selected={form.collections} onToggle={(id) => toggleIn("collections", id)} />

        {mode === "edit" && (
          <FieldText label="Source URL" value={form.source?.url ?? ""}
            onChange={(v) => set("source", v ? { ...(form.source ?? {}), url: v } : undefined)} />
        )}

        <div className={styles.row}>
          <label className={styles.field}>
            <span className="label">Visibility</span>
            <select value={form.visibility} onChange={(e) => set("visibility", e.target.value as CaptureInput["visibility"])}>
              <option value="published">Published</option>
              <option value="unlisted">Unlisted</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className={styles.field}>
            <span className="label">Flags</span>
            <div className={styles.checks} style={{ paddingTop: 6 }}>
              <label className={styles.check}>
                <input type="checkbox" checked={!!form.featured} onChange={(e) => set("featured", e.target.checked || undefined)} />
                <span>Featured</span>
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={!!form.pinned} onChange={(e) => set("pinned", e.target.checked || undefined)} />
                <span>Pinned</span>
              </label>
            </div>
          </div>
        </div>

        <Outcome status={status} />

        <div className={styles.actions}>
          <span className={styles.inferredTag}>
            {inferred.size > 0 ? `${inferred.size} field(s) inferred — verify before saving` : ""}
          </span>
          <span className={styles.spacer} />
          <button type="submit" className="btn primary" disabled={!canSubmit}>
            {status.kind === "saving" ? "Saving…" : mode === "edit" ? "Save changes" : "Add to collection"}
          </button>
        </div>
      </div>

      <div className={styles.previewCol}>
        <span className="label">Preview</span>
        <PreviewCard form={form} />
      </div>
    </form>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function FieldText({ label, value, onChange, inferred, autoFocus, required }: {
  label: string; value: string; onChange: (v: string) => void; inferred?: boolean; autoFocus?: boolean; required?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className="label">
        {label} {inferred && <span className={styles.inferredTag}>· inferred</span>}
      </span>
      <input type="text" value={value} autoFocus={autoFocus} required={required}
        className={inferred ? styles.inferred : undefined}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ChipField({ label, options, selected, onToggle }: {
  label: string; options: Option[]; selected: string[]; onToggle: (id: string) => void;
}) {
  // Show known options plus any free-form ids already on the item.
  const known = new Set(options.map((o) => o.id));
  const extras = selected.filter((s) => !known.has(s)).map((id) => ({ id, label: id }));
  const all = [...options, ...extras];
  if (all.length === 0) return null;
  return (
    <div className={styles.field}>
      <span className="label">{label}</span>
      <div className={styles.suggest}>
        {all.map((o) => (
          <button type="button" key={o.id} className={`chip ${selected.includes(o.id) ? "on" : ""}`} onClick={() => onToggle(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ form }: { form: CaptureInput }) {
  const note = form.note?.replace(/[*_`>#[\]()]/g, "").slice(0, 140);
  return (
    <div className={styles.preview}>
      <div className={styles.previewArt}>
        {form.artwork?.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview only, arbitrary remote src
          <img src={form.artwork.src} alt={form.artwork.alt || form.title} />
        ) : (
          <span aria-hidden>◆</span>
        )}
        <div className={styles.previewBadges}>
          <span className={styles.previewBadge}>{form.type}</span>
          {form.provider && form.provider !== "manual" && <span className={styles.previewBadge}>{form.provider}</span>}
        </div>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewTitle}>{form.title || "Untitled"}</div>
        {form.creator && <div className={styles.previewCreator}>{form.creator}</div>}
        {note && <div className={styles.previewNote}>{note}</div>}
      </div>
    </div>
  );
}

function Outcome({ status }: { status: Status }) {
  if (status.kind === "saved") {
    return (
      <div className={`${styles.panel} ${styles.panelOk}`}>
        Saved{status.committed ? ` · commit ${status.commit.slice(0, 7)}` : " (file written, not committed)"}.{" "}
        <a href={`/item/${status.slug}`}>View it →</a>
        <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 12 }}>
          The public site updates after the repo deploys.
        </div>
      </div>
    );
  }
  if (status.kind === "error") {
    const dupes = status.outcome && !status.outcome.ok && status.outcome.error === "duplicate" ? status.outcome.duplicates : null;
    return (
      <div className={`${styles.panel} ${styles.panelErr}`}>
        {status.message}
        {dupes && (
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {dupes.map((d, i) => (
              <li key={i}>
                {d.field}: already used by <a href={`/item/${d.existingSlug}`}>{d.existingTitle}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(p: CapturePrefill): CaptureInput {
  return {
    type: p.type ?? "website",
    provider: p.provider ?? "web",
    title: p.title ?? "",
    subtitle: p.subtitle,
    creator: p.creator,
    description: p.description,
    note: p.note,
    noteFormat: p.noteFormat,
    source: p.source,
    artwork: p.artwork,
    metadata: p.metadata,
    tags: p.tags ?? [],
    moods: p.moods ?? [],
    collections: p.collections ?? [],
    relatedItemIds: p.relatedItemIds,
    featured: p.featured,
    pinned: p.pinned,
    visibility: p.visibility ?? "published",
    discoveredAt: p.discoveredAt,
  };
}

// "note"/"website" are the unset defaults a blank capture starts on; a detected
// provider should be allowed to override them. Any other current type means the
// owner picked it on purpose, so enrichment leaves it alone.
const DEFAULT_TYPES = new Set(["website", "note"]);

/** Merge enrichment into the form — user-entered values always win. */
function mergeMeta(prev: CaptureInput, meta: Record<string, unknown>): CaptureInput {
  const take = <T,>(cur: T | undefined, next: unknown): T | undefined =>
    cur != null && cur !== "" ? cur : (next as T | undefined);
  const suggested = meta.suggestedType as string | undefined;
  return {
    ...prev,
    provider: (meta.provider as string) ?? prev.provider,
    type: prev.type && !DEFAULT_TYPES.has(prev.type) ? prev.type : suggested ?? prev.type,
    title: prev.title || (meta.title as string) || "",
    subtitle: take(prev.subtitle, meta.subtitle),
    creator: take(prev.creator, meta.creator),
    description: take(prev.description, meta.description),
    artwork: prev.artwork ?? (meta.artwork as CaptureInput["artwork"]),
    source: (meta.source as CaptureInput["source"]) ?? prev.source,
    metadata: prev.metadata ?? (meta.metadata as CaptureInput["metadata"]),
  };
}

function describe(outcome: SaveOutcome | null, status: number): string {
  if (!outcome) return status === 401 ? "Session expired — sign in again." : "Save failed.";
  if (outcome.ok) return "";
  switch (outcome.error) {
    case "duplicate": return "This looks like it's already in the collection:";
    case "conflict": return "The item changed since you opened it. Reload and reapply your edit.";
    case "validation": return `Couldn't save: ${outcome.issues.join("; ")}`;
    case "write_failed": return `Write failed: ${outcome.message}. Your draft is saved — retry.`;
    default: return "Save failed.";
  }
}
