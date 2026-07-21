/** Kebab-case slug from arbitrary text. Diacritics folded, junk dropped. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/['’]/g, "") // apostrophes vanish rather than becoming dashes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Ensure a slug/id is unique against a set of taken values by suffixing -2, -3… */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const seed = base || "item";
  if (!taken.has(seed)) return seed;
  for (let n = 2; ; n++) {
    const candidate = `${seed}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
