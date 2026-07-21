import type { Metadata } from "next";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { typesPresent } from "@/lib/content/query";
import { getContentType } from "@/lib/content/registry/content-types";
import { buildSearchIndex } from "@/lib/content/search";
import { Explorer } from "@/components/Explorer";

export const metadata: Metadata = {
  title: "Everything",
  description: "The complete, filterable collection.",
};

export default async function EverythingPage() {
  const snapshot = await loadPublicSnapshot();
  const types = typesPresent(snapshot).map((t) => ({
    id: t.type,
    label: getContentType(t.type).pluralLabel,
  }));
  const moods = snapshot.moods.map((m) => ({ id: m.id, label: m.label }));
  const index = buildSearchIndex(snapshot.items);

  return (
    <div>
      <h1 className="pixel" style={{ fontSize: "clamp(16px, 4vw, 22px)", marginBottom: 20 }}>
        Everything
      </h1>
      <Explorer items={snapshot.items} index={index} types={types} moods={moods} />
    </div>
  );
}
