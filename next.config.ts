import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statically exported: no server, no runtime, deployable as plain files.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
