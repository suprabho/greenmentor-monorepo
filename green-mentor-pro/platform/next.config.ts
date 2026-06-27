import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // viz-engine + ai-gateway ship raw TS (main: src/index.ts) — Next must
  // transpile them. This is the seam that lets us consume vismay directly
  // from the submodule via workspace:* without a build step.
  transpilePackages: ["@vismay/viz-engine", "@vismay/ai-gateway"],
};

export default nextConfig;
