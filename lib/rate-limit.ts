/**
 * In-memory fixed-window rate limiter. Per-process, which is the right scope
 * for a single-owner site running as one server; a multi-instance deployment
 * would swap this for a shared store. Keyed by an arbitrary identifier (route +
 * client hint).
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client identifier from proxy headers; falls back to a shared bucket. */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}
