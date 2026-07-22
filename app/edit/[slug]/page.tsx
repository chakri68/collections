import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isOwner } from "@/lib/auth/guard";
import { loadFullSnapshot } from "@/lib/content/loader";
import { bySlug } from "@/lib/content/query";
import { allContentTypes } from "@/lib/content/registry/content-types";
import { CaptureForm, type CapturePrefill } from "@/components/owner/CaptureForm";

export const metadata: Metadata = { title: "Edit", robots: { index: false } };

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isOwner())) redirect("/login");

  const { slug } = await params;
  const snapshot = await loadFullSnapshot();
  const item = bySlug(snapshot, slug);
  if (!item) notFound();

  const prefill: CapturePrefill = {
    type: item.type,
    provider: item.provider,
    title: item.title,
    subtitle: item.subtitle,
    creator: item.creator,
    description: item.description,
    note: item.note,
    noteFormat: item.noteFormat,
    source: item.source,
    artwork: item.artwork,
    metadata: item.metadata,
    tags: item.tags,
    moods: item.moods,
    collections: item.collections,
    relatedItemIds: item.relatedItemIds,
    featured: item.featured,
    pinned: item.pinned,
    visibility: item.visibility,
    discoveredAt: item.discoveredAt,
  };

  return (
    <div>
      <h1 className="pixel" style={{ fontSize: "clamp(16px, 4vw, 22px)", marginBottom: 6 }}>
        Edit
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 22 }}>
        Editing “{item.title}”. Saving writes a new commit.
      </p>
      <CaptureForm
        mode="edit"
        prefill={prefill}
        editingId={item.id}
        baseUpdatedAt={item.updatedAt}
        types={allContentTypes().map((t) => ({ id: t.id, label: t.label }))}
        moods={snapshot.moods.map((m) => ({ id: m.id, label: m.label }))}
        collections={snapshot.collections.map((c) => ({ id: c.id, label: c.title }))}
        tags={snapshot.tags.map((t) => ({ id: t.id, label: t.label }))}
      />
    </div>
  );
}
