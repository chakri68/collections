import Link from "next/link";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { featured, recentlyAdded, inCollection } from "@/lib/content/query";
import { Section } from "@/components/Section";
import { Grid } from "@/components/Grid";
import { RandomButton } from "@/components/RandomButton";
import styles from "./page.module.css";

export default async function Home() {
  const snapshot = await loadPublicSnapshot();
  const feat = featured(snapshot);
  const recent = recentlyAdded(snapshot, 8);
  const allSlugs = snapshot.items.map((i) => i.slug);

  // Editorial collections, most-important first, with a couple of members each.
  const collections = [...snapshot.collections]
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 3);

  return (
    <div>
      <header className={styles.hero}>
        <h1 className={`${styles.heroTitle} pixel`}>A small museum</h1>
        <p className={styles.heroLead}>
          Things worth keeping — songs, films, books, games, stray thoughts — and,
          for each, the reason it was kept.
        </p>
        <div className={styles.heroActions}>
          <Link href="/everything" className="btn primary">
            Browse everything
          </Link>
          <RandomButton slugs={allSlugs} />
        </div>
      </header>

      {feat.length > 0 && (
        <Section title="Featured" subtitle="A rotating few that get to stand at the front.">
          <Grid items={feat} />
        </Section>
      )}

      <Section
        title="Recently added"
        action={
          <Link href="/everything" className={styles.more}>
            all →
          </Link>
        }
      >
        <Grid items={recent} />
      </Section>

      {collections.map((c) => {
        const members = inCollection(snapshot, c.id).slice(0, 4);
        if (members.length === 0) return null;
        return (
          <Section key={c.id} title={c.title} subtitle={c.description}>
            <Grid items={members} />
          </Section>
        );
      })}
    </div>
  );
}
