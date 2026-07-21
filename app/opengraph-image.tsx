import { ImageResponse } from "next/og";
import { AMBER, BLACK, TEXT, MUTED, CardStack, loadMono } from "@/lib/og-mark";

export const alt =
  "Collection — a small museum of things worth keeping, and the reason each one was kept";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Site-wide social card. Amber Phosphor: black canvas, the kept-cards mark, and
 *  the wordmark. Statically generated at build; falls back to the default font if
 *  the JetBrains Mono fetch fails. */
export default async function Image() {
  const fonts = await loadMono();
  const font = fonts ? "JetBrains Mono" : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 80,
          padding: "0 96px",
          background: BLACK,
          fontFamily: font,
        }}
      >
        <CardStack w={230} />

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 74,
              fontWeight: 700,
              letterSpacing: -2,
              color: AMBER,
              textShadow: "0 0 40px rgba(255,176,0,0.55)",
            }}
          >
            collection
          </div>
          <div style={{ display: "flex", fontSize: 30, color: TEXT, lineHeight: 1.35, maxWidth: 620 }}>
            A small museum of things worth keeping — and the reason each one was kept.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 22,
              color: MUTED,
              letterSpacing: 1,
            }}
          >
            &gt; lib.chakri.me
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
