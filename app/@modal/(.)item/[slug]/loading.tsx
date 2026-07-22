import styles from "./loading.module.css";

/**
 * Prefetched fallback for the modal. Shape-matched to ItemDetail's header so
 * the swap to real content doesn't jump — art block, title, creator, a couple
 * of note lines.
 */
export default function LoadingItem() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading entry">
      <div className={styles.top}>
        <div className={`${styles.art} ${styles.pulse}`} />
        <div className={styles.head}>
          <div className={`${styles.badge} ${styles.pulse}`} />
          <div className={`${styles.title} ${styles.pulse}`} />
          <div className={`${styles.creator} ${styles.pulse}`} />
        </div>
      </div>
      <div className={`${styles.line} ${styles.pulse}`} />
      <div className={`${styles.line} ${styles.short} ${styles.pulse}`} />
    </div>
  );
}
