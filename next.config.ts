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
  // Native module (prebuilt binaries): load it from node_modules instead of bundling it.
  serverExternalPackages: ["@node-rs/argon2"],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
