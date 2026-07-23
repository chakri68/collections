/**
 * Shared pieces for the generated social/app images (opengraph, twitter,
 * apple-icon). Keeps the "stack of kept cards" mark and the font loading in one
 * place so the OG card and the iOS icon stay identical.
 *
 * These render through `next/og` (satori), so: every element with children needs
 * `display: "flex"`, and only the CSS subset satori supports is available.
 */

export const AMBER = "#ffb000";
export const BLACK = "#000000";
export const TEXT = "#ece7da";
export const MUTED = "#8b8574";

/**
 * The mark: a solid glowing amber "front" card with two dim outlined cards
 * peeking behind it. `w` is the front card's width; everything else scales off it.
 */
export function CardStack({ w }: { w: number }) {
  const ch = Math.round(w * 1.22);
  const off = Math.round(w * 0.16);
  const bw = Math.max(3, Math.round(w * 0.05)); // outline thickness
  const radius = Math.round(w * 0.11);

  const outline = (opacity: number, right: number, top: number) => (
    <div
      style={{
        position: "absolute",
        right,
        top,
        width: w,
        height: ch,
        borderRadius: radius,
        border: `${bw}px solid rgba(255,176,0,${opacity})`,
      }}
    />
  );

  const line = (lw: number, h: number, opacity: number) => (
    <div
      style={{
        width: lw,
        height: h,
        borderRadius: h / 2,
        background: `rgba(0,0,0,${opacity})`,
      }}
    />
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: w + off * 2,
        height: ch + off * 2,
      }}
    >
      {outline(0.28, 0, 0)}
      {outline(0.55, off, off)}
      {/* Front card — solid amber, glowing, with a saved-entry stub inside. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: off * 2,
          width: w,
          height: ch,
          borderRadius: radius,
          background: AMBER,
          boxShadow: `0 0 ${Math.round(w * 0.24)}px rgba(255,176,0,0.55)`,
          display: "flex",
          flexDirection: "column",
          gap: Math.round(w * 0.06),
          padding: Math.round(w * 0.15),
          paddingTop: Math.round(w * 0.2),
        }}
      >
        {line(w * 0.55, Math.round(w * 0.1), 1)}
        {line(w * 0.7, Math.round(w * 0.06), 0.62)}
        {line(w * 0.6, Math.round(w * 0.06), 0.62)}
      </div>
    </div>
  );
}

/**
 * JetBrains Mono 700 for the OG wordmark, fetched from Google Fonts at build.
 * The old User-Agent makes Google serve a plain TTF (satori can't read woff2).
 * Any failure returns undefined so the build never breaks on a flaky network —
 * satori then falls back to its bundled default font.
 */
export async function loadMono(): Promise<
  { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[] | undefined
> {
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } },
    );
    if (!cssRes.ok) return undefined;
    const css = await cssRes.text();
    const url = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:ttf|otf))\)/)?.[1];
    if (!url) return undefined;
    // A rate-limit/error page here would reach satori as "font data" and blow
    // up the render outside this try — reject anything that isn't a font.
    const fontRes = await fetch(url);
    if (!fontRes.ok || /html/.test(fontRes.headers.get("content-type") ?? "")) return undefined;
    const data = await fontRes.arrayBuffer();
    return [{ name: "JetBrains Mono", data, weight: 700, style: "normal" }];
  } catch {
    return undefined;
  }
}
