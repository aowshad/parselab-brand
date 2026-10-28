import type { NextConfig } from "next";

// Optional sub-path for hosts like GitHub Pages project sites, e.g. BASE_PATH=/brand
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  // Public pages are prerendered and cached ("use cache" in lib/brands.ts); admin saves expire them.
  cacheComponents: true,
  basePath,
  // Brand URLs end in a slash (/optionia/), the same as on every static host the site has used.
  trailingSlash: true,
  images: { unoptimized: true },
  // Native modules (prebuilt binaries): load them from node_modules instead of bundling them.
  serverExternalPackages: ["@node-rs/argon2", "sharp", "@ffmpeg-installer/ffmpeg"],
  // The ffmpeg binary is found by path at runtime, so file tracing can't see it: ship it with
  // the route that converts videos (Vercel builds on Linux x64).
  outputFileTracingIncludes: {
    "/api/internal/rebuild": ["./node_modules/.pnpm/@ffmpeg-installer+linux-x64@*/node_modules/@ffmpeg-installer/linux-x64/**"],
  },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The admin can't be framed (clickjacking) and is never cached by browsers or proxies.
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
