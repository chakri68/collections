import type { Metadata } from "next";
import { LoginForm } from "@/components/owner/LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only allow same-site relative redirects — never an absolute URL.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/capture";

  return (
    <div style={{ maxWidth: 380, margin: "40px auto" }}>
      <h1 className="pixel" style={{ fontSize: "clamp(16px, 4vw, 22px)", marginBottom: 8 }}>
        Owner
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 22 }}>
        The collection is public. Adding to it is not.
      </p>
      <LoginForm next={safeNext} />
    </div>
  );
}
