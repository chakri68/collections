import { Modal } from "@/components/Modal";

/**
 * The modal shell lives in a layout, not in the page, so it sits ABOVE the
 * Suspense boundary that loading.tsx creates. Two things follow from that:
 * the shell is part of the prefetched payload (so the modal paints the instant
 * you click, while the entry streams in behind it), and it mounts once — a
 * shell inside the page would unmount with the fallback and replay its
 * open animation when the content arrived.
 */
export default function InterceptedItemLayout({ children }: { children: React.ReactNode }) {
  return <Modal>{children}</Modal>;
}
