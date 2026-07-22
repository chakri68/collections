import { ItemDetail } from "@/components/ItemDetail";

type Params = { slug: string };

/**
 * Intercepts an in-app navigation to /item/[slug] and renders the entry in a
 * modal over the current grid. `(.)` because @modal is a slot (not a URL
 * segment), so `item` sits one segment level up. A reload or direct link isn't
 * intercepted and falls through to app/item/[slug]/page.tsx (the full page).
 *
 * The modal chrome lives in layout.tsx and loading.tsx covers this segment,
 * so the shell is up before the snapshot has loaded.
 */
export default async function InterceptedItem({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return <ItemDetail slug={slug} />;
}
