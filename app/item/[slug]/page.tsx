import type { Metadata } from "next";
import Link from "next/link";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { bySlug } from "@/lib/content/query";
import { ItemDetail } from "@/components/ItemDetail";
import styles from "./page.module.css";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const snapshot = await loadPublicSnapshot();
  return snapshot.items.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await loadPublicSnapshot();
  const item = bySlug(snapshot, slug);
  if (!item) return { title: "Not found" };

  const desc = item.note ?? item.description ?? undefined;
  return {
    title: item.title,
    description: desc?.slice(0, 200),
    openGraph: {
      title: item.title,
      description: desc?.slice(0, 200),
      images: item.artwork ? [{ url: item.artwork.src, alt: item.artwork.alt }] : undefined,
    },
  };
}

/** Full-page entry — direct navigation, reload, or shareable link (spec §11.2). */
export default async function ItemPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <article>
      <Link href="/everything" className={styles.back}>
        ← back to everything
      </Link>
      <ItemDetail slug={slug} />
    </article>
  );
}
