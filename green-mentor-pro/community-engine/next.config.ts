import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // community-engine is a package inside the pnpm workspace, so its dependencies
  // (next included) are hoisted to the monorepo-root node_modules and the Vercel
  // lambda is laid out under /var/task with that root store. Pin the file-tracing
  // root to the workspace root so Next traces the COMPLETE dependency tree. Pinning
  // it to __dirname (this app dir) put the trace root *below* the real node_modules,
  // so the tracer dropped Next's own lazily-required compiled submodules (e.g.
  // next/dist/compiled/source-map) and every server-rendered route 500'd at runtime.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Keep the headless-browser packages out of the webpack bundle so their native
  // binaries are require()d at runtime instead of being (incorrectly) bundled.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],

  // The vendored vismay packages ship raw TypeScript (main: src/index.ts).
  transpilePackages: ["@vismay/viz-engine", "@vismay/viz-admin"],

  // @sparticuz/chromium loads its brotli-packed Chromium (bin/*.br) from a path it
  // computes at runtime (import.meta.url of build/paths.js → ../bin), so Next's file
  // tracer can't see those binaries and drops them from the serverless bundle — the
  // "input directory ... bin does not exist" export failure. Force-include the package.
  //
  // The glob is resolved with cwd = this app dir (community-engine), but must land the
  // binaries where the RUNTIME resolves them. At runtime the module is reached via the
  // symlink community-engine/node_modules/@sparticuz/chromium → the pnpm store hoisted
  // to the WORKSPACE ROOT (/var/task/node_modules/.pnpm/...), so import.meta.url points
  // at the root store, not community-engine's own .pnpm. Hence "../../" — pointing at
  // the app-local .pnpm ("./") copies bin/*.br to a path the runtime never reads.
  // (Do NOT change this back to "./".)
  outputFileTracingIncludes: {
    "/api/header/export": [
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
    "/api/share-cards/export": [
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
  },
};

export default nextConfig;
