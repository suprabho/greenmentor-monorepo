import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app installs its own node_modules and deploys standalone, so pin the
  // file-tracing root here. Otherwise Next walks up to the monorepo root and lays
  // the lambda out under /var/task/green-mentor-pro/community-engine/..., which is
  // also where the wrong @sparticuz/chromium path in the export error came from.
  outputFileTracingRoot: __dirname,

  // Keep the headless-browser packages out of the webpack bundle so their native
  // binaries are require()d at runtime instead of being (incorrectly) bundled.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],

  // @sparticuz/chromium loads its brotli-packed Chromium (bin/*.br) from a path it
  // computes at runtime, so Next's file tracer can't see those binaries and drops
  // them from the serverless bundle — the "input directory ... bin does not exist"
  // export failure. Force-include the whole package for the export route.
  outputFileTracingIncludes: {
    "/api/header/export": [
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
  },
};

export default nextConfig;
