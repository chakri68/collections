import { NextResponse } from "next/server";
import { isOwner, sameOrigin } from "@/lib/auth/guard";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { createTaxonomySchema, createTaxonomyEntry } from "@/lib/capture/taxonomy";

/**
 * Owner-only: append a mood, collection, or tag to its index file and commit
 * it. Same gate as /api/items (origin + session + rate limit + schema); the
 * repo credential stays server-side.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(`taxonomy:${clientKey(request)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const parsed = createTaxonomySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 422 },
    );
  }

  const outcome = await createTaxonomyEntry(parsed.data);
  if (outcome.ok) return NextResponse.json(outcome, { status: 201 });
  return NextResponse.json(outcome, { status: outcome.error === "validation" ? 422 : 500 });
}
