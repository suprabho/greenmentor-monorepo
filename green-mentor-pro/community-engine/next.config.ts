import type { NextConfig } from "next";
import path from "node:path";

// Compose (engine 2) model routing, Phase A: with no Vercel AI Gateway key
// configured, @vismay/story-pipeline's built-in escape hatch routes every
// structured call through @anthropic-ai/sdk on the ANTHROPIC_API_KEY CE
// already uses — byte-compatible with the legacy compose. Setting
// AI_GATEWAY_API_KEY (Phase B) flips the pipeline to the gateway without a
// code change; an explicit STORY_PIPELINE_ANTHROPIC_DIRECT always wins.
if (!process.env.AI_GATEWAY_API_KEY && !process.env.STORY_PIPELINE_ANTHROPIC_DIRECT) {
  process.env.STORY_PIPELINE_ANTHROPIC_DIRECT = "1";
}

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
  // pdf-parse/pdfjs/canvas/liteparse are story-pipeline's ingest deps (all
  // lazily imported inside its src/ingest/*); externalizing keeps their native
  // binaries out of every lambda except the one route that extracts uploads.
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
    "playwright",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "@llamaindex/liteparse",
    "jsdom",
  ],

  // Next 15's webpack still follows dynamic imports INSIDE transpiled
  // packages and tries to bundle them, even when the target is listed in
  // serverExternalPackages (story-pipeline's lazy ingest imports —
  // @napi-rs/canvas ships a .node binary webpack can't parse). Force them
  // external in the server build so they're require()d from node_modules at
  // request time, exactly like the chromium/playwright entries above.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "@napi-rs/canvas": "commonjs @napi-rs/canvas",
        "pdf-parse": "commonjs pdf-parse",
        "pdfjs-dist": "commonjs pdfjs-dist",
        "@llamaindex/liteparse": "commonjs @llamaindex/liteparse",
        jsdom: "commonjs jsdom",
        mailparser: "commonjs mailparser",
      });
    }
    return config;
  },

  // The vendored vismay packages ship raw TypeScript (main: src/index.ts).
  transpilePackages: [
    "@vismay/viz-engine",
    "@vismay/viz-admin",
    "@vismay/story-reader",
    "@vismay/content-source",
    "@vismay/story-pipeline",
    "@vismay/ai-gateway",
    "@gm/story-vertical",
  ],

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
    // "Save & link to webinar" renders + uploads the cover PNG through the same
    // in-process chromium fallback as /api/header/export. Without the binaries
    // traced in, its Lambda throws "input directory … bin does not exist".
    "/api/webinars/[id]/header": [
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
    // LiteParse (story-pipeline's best PDF reader) loads a prebuilt `*.node`
    // binding plus the `libpdfium.so` it dlopen's. Next traces the `.node` from the
    // JS require, but the sibling `.so` is opened at runtime and is otherwise
    // dropped. Scoped to the ONE route that ingests uploads, so every other
    // function stays small. A tracing gap degrades to pdf-parse rather than 500ing.
    // Globs cover both the pnpm store layout and a hoisted node_modules.
    "/api/stories/[id]/compose/sources": [
      "../../node_modules/.pnpm/@llamaindex+liteparse@*/node_modules/@llamaindex/liteparse/*.{node,so}",
      "../../node_modules/@llamaindex/liteparse/*.{node,so}",
      "./node_modules/@llamaindex/liteparse/*.{node,so}",
    ],
  },
};

export default nextConfig;
