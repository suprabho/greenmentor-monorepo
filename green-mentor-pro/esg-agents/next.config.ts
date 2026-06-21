import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Agent packages are read from the filesystem at runtime (loadAgent); keep them
  // out of the bundle and let server code read agents/ + config/ directly.
  serverExternalPackages: ["@anthropic-ai/sdk", "gray-matter", "ajv", "@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/agents/**": ["./agents/**/*", "./config/**/*"],
  },
};

export default nextConfig;
