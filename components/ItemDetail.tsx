import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicSnapshot } from "@/lib/content/loader";
import { bySlug, related } from "@/lib/content/query";
import { getContentType } from "@/lib/content/registry/content-types";
import { getProvider } from "@/lib/content/registry/providers";
import { NoteMarkdown } from "./NoteMarkdown";
import { Embed } from "./Embed";
import { Grid } from "./Grid";
import { Section } from "./Section";
import { OwnerItemActions } from "./owner/OwnerItemActions";
import styles from "./ItemDetail.module.css";

/** Players this short sit in the head column, beside the art, instead of below. */
const INLINE_EMBED_MAX = 200;

const same = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Site-wide meta descriptions the scraper picks up when a page has none of its
 * own. They describe the website, not the entry.
 */
const BOILERPLATE = [/^Enjoy the videos and music you love, upload original content/];

/**
 * Scraped descriptions for music come as "Artist · Album · Song · 2020" — a
 * facts line, not prose, and half of it is already on screen. Keep only the
 * parts the header doesn't say. Prose descriptions (no separators) return null
 * and render as a paragraph instead.
 */
function factsLine(
  description: string | undefined,
  known: (string | undefined)[],
): string | null {
  if (!description) return null;
  const parts = description.split(" · ").map((p) => p.trim());
  if (parts.length < 2) return null;
  const rest = parts.filter((p) => p && !known.some((k) => same(p, k)));
  return rest.length > 0 ? rest.join(" · ") : null;
}

/**
 * The full entry rendering, shared verbatim by the permalink page and the
 * intercepted modal (spec §11.2: "On direct navigation, renders as a full entry
 * page while preserving the same content"). Server component — loads the
 * snapshot itself so both callers stay thin.
 */
export async function ItemDetail({ slug }: { slug: string }) {
  const snapshot = await loadPublicSnapshot();
  const item = bySlug(snapshot, slug);
  if (!item) notFound();

  const type = getContentType(item.type);
  const provider = getProvider(item.provider);
  const embed = provider?.getEmbed?.(item) ?? null;
  const openUrl = provider?.getOpenUrl(item) ?? item.source?.url ?? "";
  const relatedItems = related(snapshot, item, 4);

  const providerName =
    provider && provider.id !== "manual" ? provider.displayName : null;
  // The scraper stores the site name as subtitle — "Spotify" under a Spotify chip.
  const subtitle = same(item.subtitle, providerName) ? null : item.subtitle;
  const description =
    item.type === "note" || BOILERPLATE.some((re) => re.test(item.description ?? ""))
      ? undefined
      : item.description;
  const facts = factsLine(description, [
    item.creator,
    type.label,
    providerName ?? undefined,
  ]);
  const inlineEmbed =
    !!embed?.height && embed.height <= INLINE_EMBED_MAX;

  const metaEntries = Object.entries(item.metadata ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <div className={styles.detail}>
      {/* No artwork → no art column at all. A card in a grid needs the
          placeholder to hold its shape; here it's a 300px square of nothing. */}
      <div className={`${styles.top} ${item.artwork ? "" : styles.topBare}`}>
        {item.artwork && (
          <div
            className={styles.art}
            style={
              { "--art-aspect": type.defaultAspectRatio } as React.CSSProperties
            }
          >
            <Image
              src={item.artwork.src}
              alt={item.artwork.alt}
              fill
              sizes="(max-width: 720px) 100vw, 320px"
              style={{ objectFit: "cover" }}
              priority
              // Same rule as Card: only mirrored (local) artwork is optimized;
              // legacy remote URLs render as-is instead of tripping the host
              // allowlist.
              unoptimized={!item.artwork.src.startsWith("/")}
            />
          </div>
        )}

        <div className={styles.head}>
          <div className={styles.badges}>
            {/* item.type, not type.id: an unregistered type resolves to the
                generic definition, whose page doesn't exist. The provider
                chip is gone — "Open in Spotify" below already says it. */}
            <Link href={`/type/${item.type}`} className="chip on">
              {type.label}
            </Link>
            <OwnerItemActions slug={item.slug} />
          </div>
          <h1 className={`${styles.title} pixel`}>{item.title}</h1>
          {item.creator && <p className={styles.creator}>{item.creator}</p>}
          {(subtitle || facts) && (
            <p className={styles.subtitle}>
              {[subtitle, facts].filter(Boolean).join(" · ")}
            </p>
          )}

          {embed && inlineEmbed && (
            <div className={styles.inlineEmbed}>
              <Embed embed={embed} openUrl={openUrl} />
            </div>
          )}

          {openUrl && (
            <div className={styles.actions}>
              {/* With a player on the page this is the way out, not the main
                  action — so it steps down from primary. */}
              <a
                className={embed ? "btn" : "btn primary"}
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ {providerName ? `Open in ${providerName}` : "Open original"}
              </a>
            </div>
          )}
        </div>
      </div>

      {item.note && (
        <blockquote className={styles.noteBlock}>
          <NoteMarkdown source={item.note} format={item.noteFormat} />
        </blockquote>
      )}

      {/* Tags and moods are a footnote to the note, not a data table — one
          wrapping row of chips. Moods get a dot so the two kinds stay apart
          without a label column. */}
      {(item.tags.length > 0 || item.moods.length > 0) && (
        <ul className={styles.chips} aria-label="Tags and moods">
          {item.moods.map((m) => (
            <li key={`m:${m}`} className={`chip ${styles.mood}`}>
              {m}
            </li>
          ))}
          {item.tags.map((t) => (
            <li key={`t:${t}`} className={`chip ${styles.tag}`}>
              #{t}
            </li>
          ))}
        </ul>
      )}

      {description && !facts && (
        <p className={styles.description}>{description}</p>
      )}

      {embed && !inlineEmbed && (
        <div className={styles.embedWrap}>
          <Embed embed={embed} openUrl={openUrl} poster={item.artwork?.src} />
        </div>
      )}

      {metaEntries.length > 0 && (
        <dl className={styles.meta}>
          {metaEntries.map(([k, v]) => (
            <div key={k} className={styles.metaRow}>
              <dt className="label">{k}</dt>
              <dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {relatedItems.length > 0 && (
        <Section title="Related">
          <Grid items={relatedItems} />
        </Section>
      )}
    </div>
  );
}
