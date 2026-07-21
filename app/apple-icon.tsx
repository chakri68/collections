import { ImageResponse } from "next/og";
import { BLACK, CardStack } from "@/lib/og-mark";

// iOS applies its own rounded mask, so this is a full-bleed black square with the
// kept-cards mark centered — no rounding of our own.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BLACK,
        }}
      >
        <CardStack w={78} />
      </div>
    ),
    { ...size },
  );
}
