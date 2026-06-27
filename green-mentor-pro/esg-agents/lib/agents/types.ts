// Re-export shim — the canonical agent runtime now lives in @gm/agents.
// (Consolidated 2026-06-27; keeps existing @/lib/agents/types import sites working.)
export type {
  AgentModel,
  AgentFamily,
  HitlGate,
  AgentFrontmatter,
  IoSchema,
  LoadedAgent,
  AgentRunMeta,
  AgentRunResult,
  ToolContext,
} from "@gm/agents";
