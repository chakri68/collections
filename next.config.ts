import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
