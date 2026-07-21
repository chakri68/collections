import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth/guard";

/**
 * Owner-status probe for client chrome. Kept separate from page rendering so the
 * public pages stay statically generated — they never read the session cookie;
 * this endpoint does, and the client asks it after hydration.
 */
export async function GET() {
  return NextResponse.json({ owner: await isOwner() }, { headers: { "cache-control": "no-store" } });
}
