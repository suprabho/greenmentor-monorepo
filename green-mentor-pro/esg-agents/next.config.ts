import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin file-tracing to this app so Next doesn't walk to the monorepo root and lay the
  // lambda out at the wrong path (the "@sparticuz/chromium bin does not exist" failure).
  outputFileTracingRoot: __dirname,
  // Agent packages are read from the filesystem at runtime (loadAgent / readPackage);
  // keep the readers + headless-browser packages unbundled so native binaries are
  // require()d at runtime, and trace the dirs/binaries into the functions that need them.
  serverExternalPackages: ["@anthropic-ai/sdk", "gray-matter", "ajv", "@sparticuz/chromium", "playwright-core", "playwright"],
  outputFileTracingIncludes: {
    "/agents/**": ["./agents/**/*", "./config/**/*"], // Agent Studio pages (read package files)
    "/api/**": ["./agents/**/*", "./config/**/*"], // agent run / package / orchestrator routes
    // @sparticuz/chromium loads its brotli-packed binary from a runtime-computed path the
    // tracer can't see — force-include it for the PDF route. NOTE: npm flat node_modules
    // (NOT community-engine's pnpm `.pnpm/...` path).
    "/api/report/**": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
