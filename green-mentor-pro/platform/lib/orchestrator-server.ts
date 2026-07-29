import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { setAgentsRoot } from "@gm/orchestrator";

// The agent packages ship inside @gm/orchestrator's agents/ dir. Next bundles the
// transpiled package source, so the real on-disk path has to be resolved at runtime
// and handed to the engine once. Server-only.
let initialized = false;

/**
 * Candidate locations for @gm/orchestrator's agents/ dir, best first.
 *
 * require.resolve is right in a production build, but under Turbopack dev
 * `import.meta.url` is a synthetic URL containing a literal `[project]` segment —
 * require.resolve then happily returns a path *through* that segment, which doesn't
 * exist on disk. It resolves without throwing, so the try/catch alone never caught
 * it and every skill run died with `ENOENT … /[project]/…/agents/<agent>/skill.md`.
 * Hence: probe with existsSync and fall through to the workspace-relative paths.
 */
function agentsDirCandidates(): string[] {
  const out: string[] = [];
  try {
    const require = createRequire(import.meta.url);
    // require.resolve("@gm/orchestrator") → .../packages/orchestrator/src/index.ts
    out.push(path.resolve(path.dirname(require.resolve("@gm/orchestrator")), "..", "agents"));
  } catch {
    // fall through to the cwd-relative candidates
  }
  // cwd is the platform app dir (`next dev` / `next start`).
  out.push(path.resolve(process.cwd(), "../packages/orchestrator/agents"));
  out.push(path.resolve(process.cwd(), "node_modules/@gm/orchestrator/agents"));
  return out;
}

export function ensureOrchestratorInit() {
  if (initialized) return;
  const candidates = agentsDirCandidates();
  const found = candidates.find((dir) => existsSync(dir));
  if (!found) {
    // Don't throw — a skill call will surface its own structured error. Log the
    // candidates so the real path is one grep away.
    console.error("[orchestrator] agents/ dir not found. Tried:", candidates);
  }
  setAgentsRoot(found ?? candidates[0]);
  initialized = true;
}
