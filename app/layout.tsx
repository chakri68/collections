import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
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
      </body>
    </html>
  );
}
