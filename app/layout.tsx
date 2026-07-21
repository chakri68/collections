import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Script from "next/script";
import { AppFrame } from "@/components/AppFrame";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

// Non-variable font — weight is required. display:block so it never flashes a
// fallback (the pixel font shifts layout badly if it does).
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "block",
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  // The production origin, so relative OG images and canonical URLs resolve.
  metadataBase: new URL("https://lib.chakri.me"),
  title: {
    default: "Collection",
    template: "%s · Collection",
  },
  description:
    "A small personal museum of things worth keeping — and the reason each one was kept.",
  applicationName: "Collection",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Collection" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${pressStart.variable}`}>
      <body>
        <AppFrame>{children}</AppFrame>
        {modal}
        {/* Cloudflare Web Analytics — cookieless, no PII (spec §17). Loads after
            hydration so it never blocks paint. */}
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon='{"token": "d32f9ec67a08462284b59ccf606e7507"}'
        />
      </body>
    </html>
  );
}
