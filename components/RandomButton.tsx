"use client";

import { useRouter } from "next/navigation";

/** Random Thing action (spec §5.1). Picks client-side so it's fresh per click. */
export function RandomButton({ slugs, className }: { slugs: string[]; className?: string }) {
  const router = useRouter();
  const go = () => {
    if (slugs.length === 0) return;
    router.push(`/item/${slugs[Math.floor(Math.random() * slugs.length)]}`);
  };
  return (
    <button className={className ?? "btn"} onClick={go} disabled={slugs.length === 0}>
      ◆ Random thing
    </button>
  );
}
