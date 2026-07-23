import { NextResponse } from "next/server";
import { isOwner, sameOrigin } from "@/lib/auth/guard";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { saveRequestSchema } from "@/lib/capture/types";
import { saveItem } from "@/lib/capture/save";

// Text fields are small, but an uploaded image rides along as a base64 data:
// URL in artwork.src — sized to fit the 4 MB image cap (spec §8.1 step 2).
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/**
 * The Git-backed write endpoint (spec §8.1). Auth + CSRF + size + schema, then
 * hand off to saveItem which owns dedupe, conflict detection, and the commit.
 * The repo credential never leaves the server — the browser only ever sees the
 * returned SHA and status.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(`items:${clientKey(request)}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const parsed = saveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 422 },
    );
  }

  const outcome = await saveItem(parsed.data);

  if (outcome.ok) return NextResponse.json(outcome, { status: 201 });

  const status =
    outcome.error === "duplicate" ? 409 :
    outcome.error === "conflict" ? 409 :
    outcome.error === "validation" ? 422 :
    500;
  return NextResponse.json(outcome, { status });
}
