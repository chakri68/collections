import Image from "next/image";
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
            <span className="chip on">{type.label}</span>
            {provider && provider.id !== "manual" && (
              <span className="chip">{provider.displayName}</span>
            )}
            <OwnerItemActions slug={item.slug} />
          </div>
          <h1 className={`${styles.title} pixel`}>{item.title}</h1>
          {item.creator && <p className={styles.creator}>{item.creator}</p>}
          {item.subtitle && <p className={styles.subtitle}>{item.subtitle}</p>}

          {(embed || openUrl) && (
            <div className={styles.actions}>
              {embed ? (
                <span className={styles.embedHint}>Playable below</span>
              ) : openUrl ? (
                <a
                  className="btn primary"
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ↗ Open original
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {item.note && (
        <div className={styles.noteBlock}>
          <NoteMarkdown source={item.note} format={item.noteFormat} />
        </div>
      )}

      {item.description && item.type !== "note" && (
        <p className={styles.description}>{item.description}</p>
      )}

      {embed && (
        <div className={styles.embedWrap}>
          <Embed embed={embed} openUrl={openUrl} />
        </div>
      )}

      {(metaEntries.length > 0 ||
        item.tags.length > 0 ||
        item.moods.length > 0) && (
        <dl className={styles.meta}>
          {metaEntries.map(([k, v]) => (
            <div key={k} className={styles.metaRow}>
              <dt className="label">{k}</dt>
              <dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
            </div>
          ))}
          {item.tags.length > 0 && (
            <div className={styles.metaRow}>
              <dt className="label">Tags</dt>
              <dd className={styles.chips}>
                {item.tags.map((t) => (
                  <span key={t} className="chip">
                    #{t}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {item.moods.length > 0 && (
            <div className={styles.metaRow}>
              <dt className="label">Mood</dt>
              <dd className={styles.chips}>
                {item.moods.map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </dd>
            </div>
          )}
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
