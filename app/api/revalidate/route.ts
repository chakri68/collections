import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Purge the content cache on demand. The app's own write endpoint revalidates
 * inline after a commit, so this exists for content changed OUTSIDE the app —
 * e.g. editing a JSON file directly on GitHub. Point a GitHub webhook (push,
 * filtered to content/) or Action at it. Shared-secret auth; without the secret
 * set the endpoint is disabled.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "revalidation disabled" }, { status: 404 });

  const provided =
    request.headers.get("x-revalidate-secret") ??
    new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  revalidateTag("content", "max");
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidated: true });
}
