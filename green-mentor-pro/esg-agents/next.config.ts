import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// Load shared server-side config (EFDB creds etc.) from the single source of
// truth at green-mentor-pro/.env.shared, so platform + esg-agents don't each
// keep a copy. loadEnvFile never overrides real env already set (shell / Fly
// win), and the file is absent in prod. See green-mentor-pro/.env.shared.example.
const sharedEnv = path.join(__dirname, "..", ".env.shared");
if (existsSync(sharedEnv)) process.loadEnvFile(sharedEnv);

const nextConfig: NextConfig = {
  // @gm/agents ships raw TS (main: src/index.ts) and is consumed via workspace:* with
  // no build step, so Next must transpile it (same seam the platform app uses).
  transpilePackages: ["@gm/agents"],
  // esg-agents is a package inside the pnpm workspace; its deps live in the monorepo-root
  // node_modules/.pnpm store. Trace from the workspace root (NOT __dirname) so Next sees the
  // COMPLETE dependency tree — pinning to this app dir puts the trace root *below* the real
  // store, so the tracer drops Next's own lazily-required submodules and routes 500 at runtime.
  // (Matches community-engine. We use pnpm's default isolated linker now — see note on the
  // chromium include below — which is also what gives @gm/agents a deterministic ai@6.)
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Agent packages are read from the filesystem at runtime (loadAgent / readPackage);
  // keep the readers + headless-browser packages unbundled so native binaries are
  // require()d at runtime, and trace the dirs/binaries into the functions that need them.
  // isomorphic-dompurify/jsdom must stay external too: bundling jsdom breaks its
  // __dirname-relative read of browser/default-stylesheet.css ("ENOENT ... default-stylesheet.css"
  // while collecting page data for /api/report/[engagementId]/pdf).
  serverExternalPackages: ["@anthropic-ai/sdk", "gray-matter", "ajv", "@sparticuz/chromium", "playwright-core", "playwright", "isomorphic-dompurify", "jsdom"],
  // Paths below are relative to the workspace-root tracing root above.
  outputFileTracingIncludes: {
    "/agents/**": ["./green-mentor-pro/esg-agents/agents/**/*", "./green-mentor-pro/esg-agents/config/**/*"], // Agent Studio pages (read package files)
    "/api/**": ["./green-mentor-pro/esg-agents/agents/**/*", "./green-mentor-pro/esg-agents/config/**/*"], // agent run / package / orchestrator routes
    // @sparticuz/chromium loads its brotli-packed binary from a runtime-computed path the
    // tracer can't see — force-include it for the PDF route, via the pnpm isolated-store path
    // (the approach community-engine ships) now that we no longer flatten node_modules.
    // CAVEAT: the PDF route's bundle is almost entirely serverExternalPackages, so Next may
    // omit it from the include loop and this glob won't fire — the binary bundling for
    // /api/report/[engagementId]/pdf needs runtime verification (pre-existing; unrelated to
    // the build fix this config unblocks).
    "/api/report/**": ["./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
