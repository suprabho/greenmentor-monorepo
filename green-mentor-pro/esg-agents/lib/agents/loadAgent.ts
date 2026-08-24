// esg-agents binds the shared @gm/agents loader to ITS package store. The runtime
// lives in @gm/agents (deliberately infra-free); the Supabase-backed overrides live
// here, same seam as lib/agents/runAgent.ts binding toolHandlers.
import { applyPackageOverrides, compileAgent, readRawPackage } from "@gm/agents";
import type { LoadedAgent } from "@gm/agents";
import { readOverrides } from "@/lib/db/agentPackages";

export { loadAgent, loadAllAgents } from "@gm/agents";

/**
 * Load a package with any Studio edits laid over the bundled files. Use this on every
 * path that actually runs an agent — the deployed filesystem is read-only, so the DB
 * is where an edit made in production lives.
 */
export async function loadAgentWithOverrides(agentKey: string): Promise<LoadedAgent> {
  const raw = readRawPackage(agentKey);
  return compileAgent(applyPackageOverrides(raw, await readOverrides(agentKey)));
}
