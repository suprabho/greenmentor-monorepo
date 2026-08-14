import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// Load shared server-side config (EFDB creds etc.) from the single source of
// truth at green-mentor-pro/.env.shared, so platform + esg-agents don't each
// keep a copy. loadEnvFile never overrides real env already set (shell / Vercel
// / Fly win), and the file is absent in prod — so this is dev/local convenience
// only. See green-mentor-pro/.env.shared.example.
const sharedEnv = path.join(__dirname, "..", ".env.shared");
if (existsSync(sharedEnv)) process.loadEnvFile(sharedEnv);

const nextConfig: NextConfig = {
  // viz-engine + ai-gateway ship raw TS (main: src/index.ts) — Next must
  // transpile them. This is the seam that lets us consume vismay directly
  // from the submodule via workspace:* without a build step. story-reader +
  // content-source (pure subpaths only) power the /stories scrollytelling
  // reader; @gm/story-vertical carries the GreenMentor story modules.
  transpilePackages: [
    "@vismay/viz-engine",
    "@vismay/ai-gateway",
    "@vismay/story-reader",
    "@vismay/content-source",
    "@gm/agents",
    "@gm/orchestrator",
    "@gm/story-vertical",
  ],
};

export default nextConfig;
