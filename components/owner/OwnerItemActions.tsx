"use client";

import Link from "next/link";
import { useOwner } from "./useOwner";

/** Edit link on an entry, owner-only. Archiving is done through the edit form's
 *  visibility select (spec §8.3: default delete = set visibility to archived). */
export function OwnerItemActions({ slug }: { slug: string }) {
  const owner = useOwner();
  if (!owner) return null;
  return (
    <Link href={`/edit/${slug}`} className="chip" style={{ marginLeft: 8 }}>
      ✎ Edit
    </Link>
  );
}
