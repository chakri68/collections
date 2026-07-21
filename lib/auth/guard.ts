import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

/** Read + verify the session cookie. Async because cookies() is async in Next 16. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function isOwner(): Promise<boolean> {
  return (await getSession()) !== null;
}

/**
 * Same-origin check for state-changing requests (spec §8.1 step 2 CSRF). The
 * session cookie is SameSite=Lax + HttpOnly, but we also reject cross-origin
 * Origin headers as belt-and-suspenders — the same policy Server Actions apply.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin navigations/fetches often omit Origin
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
