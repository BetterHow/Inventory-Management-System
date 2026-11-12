import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  experimental: {
    // Pages already opened (or prefetched on hover) are reused for this many seconds. Any save clears them.
    staleTimes: { dynamic: 30, static: 60 },
  },
};

export default nextConfig;
