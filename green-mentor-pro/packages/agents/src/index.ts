// @gm/agents — the canonical, infra-free ESG agent runtime extracted from
// esg-agents. Consumed by BOTH esg-agents (full 8-phase pipeline) and the
// platform (per-run AI Hub). Callable (grounding) tools are injected by the
// consumer via runAgent's RunAgentOptions, so this package has no dependency
// on any app's database / EFDB / orchestrator.
export * from "./types";
export * from "./loadAgent";
export * from "./runAgent";
export * from "./packageIO";
export { getClient } from "./anthropic/client";
export { MODELS, supportsTemperature, type ModelTier } from "./anthropic/models";

// ESG Buddy — the shared chat gateway (AI SDK) + generative-UI tools, consumed by
// both esg-agents (app/api/chat) and the platform (/api/buddy/chat).
export * from "./buddy";
export * from "./buddyTools";

// Domain restriction: the shared scope/safety policy (prompt layer) and the
// pre-flight input guard (programmatic layer) that keep every chat surface on-ESG.
export * from "./policy";
export * from "./guard";
