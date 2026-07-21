import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/**
 * Minimal single-owner session, no external dep. The site has exactly one
 * writer, so a password → signed cookie is enough; there's no user table to
 * justify a JWT library. Token = base64url(payload).base64url(HMAC-SHA256).
 *
 * Secrets come from env. Dev falls back to a random per-process secret (so
 * sessions simply don't survive a restart) and a default password, with a loud
 * warning — never ship without setting these.
 */

export const SESSION_COOKIE = "collection_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

let warned = false;
function devWarn(msg: string) {
  if (!warned) {
    console.warn(`[auth] ${msg}`);
    warned = true;
  }
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  devWarn("SESSION_SECRET unset — using an ephemeral dev secret; set it in .env.local for real use.");
  return (globalThis as { __devSecret?: string }).__devSecret ??=
    randomBytes(32).toString("hex");
}

/** The owner password. Set OWNER_PASSWORD in the environment. */
function ownerPassword(): string {
  const p = process.env.OWNER_PASSWORD;
  if (p && p.length > 0) return p;
  devWarn("OWNER_PASSWORD unset — using dev default 'let-me-in'; set it in .env.local.");
  return "let-me-in";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export interface SessionPayload {
  sub: "owner";
  exp: number; // unix seconds
}

export function createSessionToken(now = Math.floor(Date.now() / 1000)): { token: string; maxAge: number } {
  const payload: SessionPayload = { sub: "owner", exp: now + SESSION_TTL_SECONDS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return { token: `${body}.${sign(body)}`, maxAge: SESSION_TTL_SECONDS };
}

/** Verify signature + expiry. Returns the payload or null. Constant-time on the MAC. */
export function verifySessionToken(token: string | undefined, now = Math.floor(Date.now() / 1000)): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.sub !== "owner" || typeof payload.exp !== "number" || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Constant-time password check. */
export function passwordMatches(candidate: string): boolean {
  const expected = Buffer.from(ownerPassword());
  const got = Buffer.from(candidate);
  // Pad to equal length so timingSafeEqual doesn't throw and length isn't leaked by early return.
  const len = Math.max(expected.length, got.length);
  const ea = Buffer.alloc(len);
  const ga = Buffer.alloc(len);
  expected.copy(ea);
  got.copy(ga);
  return timingSafeEqual(ea, ga) && expected.length === got.length;
}
