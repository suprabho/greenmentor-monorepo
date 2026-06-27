// @gm/orchestrator — the BRSR engagement orchestration engine, extracted from the
// esg-agents app so any sibling app (e.g. the platform) can drive the full 8-phase
// pipeline. Infra-coupled: it owns the DB repositories (Supabase service-role),
// the EFDB client, and the callable-tool handlers that ground agent runs. The
// infra-free agent runtime itself lives in @gm/agents, which this package wraps in
// runPhase by injecting these toolHandlers.

// ── Orchestrator: the phase state machine + per-phase runner ──
export * from "./orchestrator/pipeline";
export * from "./orchestrator/gates";
export * from "./orchestrator/runPhase";
export * from "./orchestrator/assembleInput";
export * from "./orchestrator/quality";

// ── DB repositories (all tenant-scoped by orgId) ──
export * from "./db/types";
export * from "./db/artifacts";
export * from "./db/dataCollection";
export * from "./db/engagements";
export * from "./db/messages";
export * from "./db/phases";
export * from "./db/reviews";
export * from "./db/runs";
export * from "./db/validations";

// ── Grounding tools, EFDB client, service-role admin client ──
export * from "./toolHandlers";
export * from "./efdb/client";
export * from "./admin";

// ── Agent-package root resolution (the agent packages ship in this package's
//    agents/ dir; the consuming app calls setAgentsRoot once at startup) ──
export * from "./agentsRoot";

// ── Engagement Report Copilot: system prompt + tool factory (AI SDK) ──
export * from "./copilot";
export * from "./copilotTools";
