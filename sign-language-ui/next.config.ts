import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reverse-proxy PostHog through our own domain so ad-blockers don't drop analytics.
  // The SDK is pointed at "/ingest" (see app/providers.tsx).
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Preserve the old shared /TranslationDemo link by redirecting it to /Translation.
  async redirects() {
    return [
      { source: "/TranslationDemo", destination: "/Translation", permanent: true },
    ];
  },
  // PostHog uses trailing-slash API routes; don't redirect them.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
