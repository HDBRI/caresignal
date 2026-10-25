import type { NextConfig } from "next";
import { loadEnv } from "./src/lib/env";

// Project-folder .env first, then the parent folder's .env (values are never printed).
loadEnv();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the root to this folder (the parent course folder also has a package.json).
  turbopack: { root: import.meta.dirname },
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
