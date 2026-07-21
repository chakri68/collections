import type { ContentItem } from "@/lib/content/types";
import { Card } from "./Card";
import styles from "./Grid.module.css";

export function Grid({ items }: { items: ContentItem[] }) {
  if (items.length === 0) {
    return <p className={styles.empty}>Nothing here yet.</p>;
  }
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Card key={item.id} item={item} />
      ))}
    </div>
  );
}
