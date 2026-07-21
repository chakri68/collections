import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, passwordMatches } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/guard";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  // Throttle brute force: 10 attempts / 5 min per client.
  const limit = rateLimit(`login:${clientKey(request)}`, 10, 5 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }

  const { token, maxAge } = createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return NextResponse.json({ ok: true });
}
