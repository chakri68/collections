import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth/guard";
import { loadFullSnapshot } from "@/lib/content/loader";
import { allContentTypes } from "@/lib/content/registry/content-types";
import { toShareInput, resolveProvider } from "@/lib/content/registry/providers";
import { CaptureForm, type CapturePrefill } from "@/components/owner/CaptureForm";

export const metadata: Metadata = { title: "Add", robots: { index: false } };

/** Share target lands here via GET (manifest params title/text/url), and so does the in-app Add button. */
export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  // Proxy gates this, but re-check here too (proxy is optimistic only).
  if (!(await isOwner())) redirect("/login?next=/capture");

  const raw = await searchParams;
  const share = toShareInput(raw);

  // Network-free normalize for an instant prefill; the client enriches via
  // /api/metadata (which does the actual scrape behind the SSRF guard).
  const adapter = await resolveProvider(share);
  const normalized = await adapter.normalize(share);

  const prefill: CapturePrefill = {
    provider: adapter.id,
    type: normalized.suggestedType,
    title: raw.title ?? "",
    note: adapter.id === "manual" ? raw.text : undefined,
    noteFormat: adapter.id === "manual" ? "plain" : undefined,
    source: normalized.url
      ? {
          url: normalized.url,
          canonicalUrl: normalized.canonicalUrl || undefined,
          providerId: normalized.providerId,
          embedUrl: normalized.embedUrl,
        }
      : undefined,
  };

  const snapshot = await loadFullSnapshot();

  return (
    <div>
      <h1 className="pixel" style={{ fontSize: "clamp(16px, 4vw, 22px)", marginBottom: 6 }}>
        Add a thing
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 22 }}>
        {normalized.url
          ? `From ${adapter.displayName}. Verify the inferred fields, then save.`
          : "Paste a link to pull in a song, video, or page — or just write a note."}
      </p>
      <CaptureForm
        mode="create"
        prefill={prefill}
        rawShare={raw}
        types={allContentTypes().map((t) => ({ id: t.id, label: t.label }))}
        moods={snapshot.moods.map((m) => ({ id: m.id, label: m.label }))}
        collections={snapshot.collections.map((c) => ({ id: c.id, label: c.title }))}
      />
    </div>
  );
}
