import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Lets a second local sign-in run on 127.0.0.1 next to localhost (separate cookies) during development.
  allowedDevOrigins: ["127.0.0.1"],
  partialPrefetching: true,
  experimental: {
    // Everything under /app renders on the client after the Supabase session is verified, so Next's
    // dev-time instant-navigation check would flag every page as "dropped". Validate only segments
    // that opt in with `export const instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
