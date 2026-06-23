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

/**
 * Newer models reject the (now-deprecated) `temperature` param — sending it is a
 * 400 ("temperature is deprecated for this model"). Opus 4.8 is one such model;
 * Sonnet 4.6 / Haiku 4.5 still accept it. Callers should omit temperature when this
 * returns false.
 */
export function supportsTemperature(model: string): boolean {
  return !/opus-4-8/.test(model);
}
