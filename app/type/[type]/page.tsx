import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { byType, typesPresent } from "@/lib/content/query";
import { getContentType } from "@/lib/content/registry/content-types";
import { buildSearchIndex } from "@/lib/content/search";
import { Explorer } from "@/components/Explorer";

type Params = { type: string };

/** Pre-render a page per type actually present in the collection. */
export async function generateStaticParams(): Promise<Params[]> {
  const snapshot = await loadPublicSnapshot();
  return typesPresent(snapshot).map((t) => ({ type: t.type }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { type } = await params;
  const def = getContentType(type);
  return { title: def.pluralLabel, description: `Everything of type: ${def.pluralLabel}.` };
}

export default async function TypePage({ params }: { params: Promise<Params> }) {
  const { type } = await params;
  const snapshot = await loadPublicSnapshot();
  const items = byType(snapshot, type);
  if (items.length === 0) notFound();

  const def = getContentType(type);
  const moods = snapshot.moods.map((m) => ({ id: m.id, label: m.label }));
  const index = buildSearchIndex(items);

  return (
    <div>
      <h1 className="pixel" style={{ fontSize: "clamp(16px, 4vw, 22px)", marginBottom: 20 }}>
        {def.icon} {def.pluralLabel}
      </h1>
      <Explorer items={items} index={index} types={[]} moods={moods} lockedType={type} />
    </div>
  );
}
