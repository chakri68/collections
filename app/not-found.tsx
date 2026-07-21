import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <h1 className="pixel" style={{ fontSize: "clamp(16px, 5vw, 24px)", marginBottom: 16 }}>
        404 — not in the archive
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Nothing lives at this address. It may have been archived, or never existed.
      </p>
      <Link href="/" className="btn primary">
        ← back to the front
      </Link>
    </div>
  );
}
