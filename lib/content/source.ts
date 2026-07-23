import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

/**
 * Where the raw content JSON comes from. Two modes:
 *
 *  - "fs" (default): read the local content/ directory. Used in dev and in a
 *    build that ships the content with the code.
 *  - "github": fetch content from the GitHub repo at RUNTIME. This decouples
 *    content from deploys — a content-only commit shows up without a rebuild
 *    (Vercel's Ignored Build Step skips those; see scripts/vercel-ignore-build.js).
 *    Reads go through Next's fetch cache, tagged "content", so they're cheap and
 *    can be revalidated on demand (the write endpoint calls revalidateTag).
 *
 * Set CONTENT_SOURCE=github (plus GITHUB_REPO / GITHUB_BRANCH, and GITHUB_TOKEN
 * for a private repo) to switch modes.
 */

export interface ContentFile {
  /** Repo-relative POSIX path, e.g. "content/items/2026/arrival.json". */
  path: string;
  text: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");
const INDEX_FILES = new Set([
  "content/collections.json",
  "content/tags.json",
  "content/moods.json",
]);

/** Time-based safety net; on-demand revalidateTag("content") is the primary path. */
const REVALIDATE_SECONDS = Number(process.env.CONTENT_REVALIDATE ?? 300);

function isContentFile(repoPath: string): boolean {
  if (!repoPath.endsWith(".json")) return false;
  return repoPath.startsWith("content/items/") || INDEX_FILES.has(repoPath);
}

// ── Filesystem source ────────────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

async function fsFiles(): Promise<ContentFile[]> {
  const abs = [
    ...(await walk(path.join(CONTENT_DIR, "items"))),
    ...[...INDEX_FILES].map((rel) => path.join(process.cwd(), rel)),
  ];
  const files: ContentFile[] = [];
  for (const file of abs) {
    try {
      const text = await fs.readFile(file, "utf8");
      files.push({ path: toRepoPath(file), text });
    } catch {
      // Missing index file (e.g. no moods.json yet) — skip.
    }
  }
  return files;
}

function toRepoPath(abs: string): string {
  return path.relative(process.cwd(), abs).split(path.sep).join("/");
}

// ── GitHub source ────────────────────────────────────────────────────────────

const GH_API = "https://api.github.com";

export function ghHeaders(raw = false): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "collection",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFiles(): Promise<ContentFile[]> {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  if (!repo) {
    console.warn("[content] CONTENT_SOURCE=github but GITHUB_REPO is unset — returning empty.");
    return [];
  }

  const next = { revalidate: REVALIDATE_SECONDS, tags: ["content"] };

  // One call lists the whole tree; filter to the content files we care about.
  const treeRes = await fetch(
    `${GH_API}/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: ghHeaders(), next },
  );
  if (!treeRes.ok) {
    console.warn(`[content] github tree read failed (${treeRes.status}) — returning empty.`);
    return [];
  }
  const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
  const paths = (tree.tree ?? [])
    .filter((e) => e.type === "blob" && isContentFile(e.path))
    .map((e) => e.path);

  // Fetch each file's raw content. Contents API with the raw accept header works
  // for public and private repos alike.
  const files = await Promise.all(
    paths.map(async (p): Promise<ContentFile | null> => {
      const res = await fetch(
        `${GH_API}/repos/${repo}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
        { headers: ghHeaders(true), next },
      );
      if (!res.ok) {
        console.warn(`[content] github read failed for ${p} (${res.status})`);
        return null;
      }
      return { path: p, text: await res.text() };
    }),
  );
  return files.filter((f): f is ContentFile => f !== null);
}

// ── Public API ───────────────────────────────────────────────────────────────

function mode(): "fs" | "github" {
  return process.env.CONTENT_SOURCE === "github" ? "github" : "fs";
}

/**
 * All content JSON files. `cache()` dedupes within a single render pass; across
 * requests, the fetch cache (github mode) or a fresh disk read (fs mode) governs
 * freshness. Never throws — a source failure yields an empty collection, not a
 * crashed page (spec §10).
 */
export const readContentFiles = cache(async (): Promise<ContentFile[]> => {
  try {
    return mode() === "github" ? await githubFiles() : await fsFiles();
  } catch (err) {
    console.warn("[content] source read failed — returning empty:", err);
    return [];
  }
});
