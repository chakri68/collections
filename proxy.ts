import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Optimistic auth gate (Next 16 renamed Middleware → Proxy; Node runtime).
 * This only improves UX — it bounces unauthenticated visitors off owner routes
 * before render. It is NOT the security boundary: every write route handler
 * re-verifies the session itself (see lib/auth/guard). Redirecting here just
 * avoids flashing an owner page and then failing.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/capture", "/capture/:path*", "/edit/:path*"],
};
