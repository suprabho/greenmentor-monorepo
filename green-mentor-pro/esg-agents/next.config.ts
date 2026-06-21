import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Agent packages are read from the filesystem at runtime (loadAgent / readPackage);
  // keep the readers unbundled and trace the agents/ + config/ dirs into every
  // serverless function that touches them, or they 500 on Vercel.
  serverExternalPackages: ["@anthropic-ai/sdk", "gray-matter", "ajv", "@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/agents/**": ["./agents/**/*", "./config/**/*"], // Agent Studio pages (read package files)
    "/api/**": ["./agents/**/*", "./config/**/*"], // agent run / package / orchestrator routes
  },
};

export default nextConfig;
