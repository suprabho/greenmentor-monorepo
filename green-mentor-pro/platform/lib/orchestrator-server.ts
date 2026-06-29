import path from "node:path";
import { createRequire } from "node:module";
import { setAgentsRoot } from "@gm/orchestrator";

// The agent packages ship inside @gm/orchestrator's agents/ dir. Next bundles the
// transpiled package source, so resolve the real on-disk path via require.resolve
// (works regardless of cwd) and point the engine at it once. Server-only.
let initialized = false;

export function ensureOrchestratorInit() {
  if (initialized) return;
  let agentsDir: string;
  try {
    const require = createRequire(import.meta.url);
    // require.resolve("@gm/orchestrator") → .../packages/orchestrator/src/index.ts
    agentsDir = path.resolve(path.dirname(require.resolve("@gm/orchestrator")), "..", "agents");
  } catch {
    agentsDir = path.resolve(process.cwd(), "../packages/orchestrator/agents");
  }
  setAgentsRoot(agentsDir);
  initialized = true;
}
