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
