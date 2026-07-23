import { promises as fs } from "node:fs";
import path from "node:path";
import { ARTWORK_DIR, ARTWORK_CONTENT_TYPES } from "@/lib/capture/artwork";
import { ghHeaders } from "@/lib/content/source";

/**
 * Serves mirrored artwork out of content/images/, mirroring source.ts's two
 * modes: local disk by default, the GitHub contents API when the deployed app
 * reads content from the repo at runtime (CONTENT_SOURCE=github).
 *
 * Filenames embed a content hash (lib/capture/artwork.ts), so a URL's bytes
 * never change — responses are safely immutable and edits get a fresh URL.
 */

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const FILENAME = /^[a-z0-9][a-z0-9-]*\.([a-z0-9]+)$/;

function validate(segments: string[]): { rel: string; contentType: string } | null {
  if (segments.length === 0) return null;
  const file = segments[segments.length - 1];
  const dirs = segments.slice(0, -1);
  if (!dirs.every((s) => SEGMENT.test(s))) return null;
  const ext = file.match(FILENAME)?.[1];
  const contentType = ext ? ARTWORK_CONTENT_TYPES[ext] : undefined;
  if (!contentType) return null;
  return { rel: segments.join("/"), contentType };
}

async function readLocal(rel: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), ARTWORK_DIR, rel));
    // Copy out of Buffer's shared pool — .buffer alone can carry neighbors.
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

async function readGithub(rel: string): Promise<ArrayBuffer | null> {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  if (!repo) return null;
  const repoPath = `${ARTWORK_DIR}/${rel}`;
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${repoPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(true), cache: "force-cache" },
  );
  if (!res.ok) return null;
  return res.arrayBuffer();
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const valid = validate(segments);
  if (!valid) return new Response("not found", { status: 404 });

  const bytes =
    process.env.CONTENT_SOURCE === "github"
      ? await readGithub(valid.rel)
      : await readLocal(valid.rel);
  if (!bytes) return new Response("not found", { status: 404 });

  return new Response(bytes, {
    headers: {
      "content-type": valid.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
