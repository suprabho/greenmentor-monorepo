import type { AgentModel } from "../agents/types";

/**
 * Central model registry. Defaults are the latest Claude tiers; override per-env.
 * Heavy extraction/reasoning -> opus; balanced -> sonnet; cheap drafts -> haiku.
 */
export const MODELS = {
  opus: (process.env.ANTHROPIC_MODEL_OPUS ?? "claude-opus-4-8") as AgentModel,
  sonnet: (process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-6") as AgentModel,
  haiku: (process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5") as AgentModel,
} as const;

export type ModelTier = keyof typeof MODELS;
