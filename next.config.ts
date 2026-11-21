import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Portfolio images are served through /media/... (see app/media) and optimised by Next.
    localPatterns: [{ pathname: "/media/**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
};
export default nextConfig;
