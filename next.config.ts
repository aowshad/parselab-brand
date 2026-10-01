import type { NextConfig } from "next";

// Optional sub-path for hosts like GitHub Pages project sites, e.g. BASE_PATH=/brand
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
