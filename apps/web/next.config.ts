import type { NextConfig } from "next";
import { join } from "node:path";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../.."),
  transpilePackages: ["@torob/core", "@torob/db"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.torob.com" }],
    unoptimized: true,
  },
  experimental: { optimizePackageImports: ["lucide-react"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(self), microphone=(self), camera=()" },
        ],
      },
    ];
  },
};

export default config;
