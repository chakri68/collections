import Link from "next/link";
import Image from "next/image";
import type { ContentItem } from "@/lib/content/types";
import { getContentType } from "@/lib/content/registry/content-types";
import { getProvider } from "@/lib/content/registry/providers";
import { CardPending } from "./CardPending";
import styles from "./Card.module.css";

/**
 * The one card composition every listing uses (spec §11.1). Types/providers
 * supply visual tokens (icon, aspect ratio) but never replace the base layout.
 * Server component — no interactivity beyond the link.
 */
export function Card({ item }: { item: ContentItem }) {
  const type = getContentType(item.type);
  const provider = getProvider(item.provider);
  const notePreview = item.noteFormat === "markdown" ? stripMarkdown(item.note) : item.note;

  return (
    // Grid cards are uniform: one art aspect for every type (the type-specific
    // ratio lives on the detail view). Keeps the grid tidy instead of ragged.
    <article className={styles.card}>
      {/* transitionTypes tags this navigation so AppFrame's boundary can sit it
          out — this opens a modal over the grid, it doesn't replace the grid. */}
      <Link
        href={`/item/${item.slug}`}
        transitionTypes={["modal"]}
        className={styles.link}
        aria-label={item.title}
      >
        <div className={styles.art}>
          {item.artwork ? (
            <Image
              src={item.artwork.src}
              alt={item.artwork.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className={styles.fallback} aria-hidden>
              {type.icon}
            </div>
          )}
          <div className={styles.badges}>
            <span className={styles.badge}>{type.label}</span>
            {provider && provider.id !== "manual" && (
              <span className={styles.badge}>{provider.displayName}</span>
            )}
          </div>
          <CardPending />
        </div>

        <div className={styles.body}>
          <h3 className={styles.title}>{item.title}</h3>
          <p className={styles.creator}>{item.creator ?? item.subtitle ?? " "}</p>
          <p className={styles.note}>{notePreview ?? ""}</p>
        </div>
      </Link>
    </article>
  );
}

/** Cheap markdown-to-text for the card preview; the full render is sanitized elsewhere. */
function stripMarkdown(md?: string): string | undefined {
  if (!md) return undefined;
  return md
    .replace(/[*_`>#-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
