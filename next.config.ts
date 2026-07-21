import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React's <ViewTransition> for animated route changes (spec §16 motion).
    viewTransition: true,
  },
  images: {
    // Remote artwork hosts. Providers that expose deterministic thumbnail URLs
    // are allowlisted here (spec §12 prefers local optimized artwork, but a
    // remote URL + fallback is the permitted alternative).
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/**" },
      { protocol: "https", hostname: "i.scdn.co", pathname: "/**" },
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/**" },
    ],
  },
};

export default nextConfig;
