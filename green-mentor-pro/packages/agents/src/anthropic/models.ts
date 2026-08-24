import type { AgentModel } from "../types";

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

/** One entry in the Agent Studio's model dropdown. `note` renders as a ⚠ hint. */
export interface AgentModelChoice {
  id: AgentModel;
  label: string;
  note?: string;
}

/**
 * Every model an agent package may declare, newest generation first — the option
 * list behind the Studio's model selectors and the allowlist `isAgentModel` checks.
 *
 * The notes on the 5-series are ours, not Anthropic's: agents finish through a
 * forced `emit_*` tool whose arguments are Ajv-validated, so structured-emit
 * reliability is the property that actually decides whether a run succeeds. Measured
 * against `anglesBriefSchema` (2026-08-18): sonnet-5 0/4 · opus-4-8 1/2 · opus-5 1/2
 * · fable-5 2/2.
 *
 * This module is the client-safe `@gm/agents/models` subpath — it imports only a
 * type, and its `process.env` reads are all `??`-defaulted, so bundling it into a
 * client component is safe. Keep it that way: no `node:*` imports here.
 */
export const AGENT_MODEL_CHOICES: AgentModelChoice[] = [
  {
    id: "claude-fable-5",
    label: "fable-5",
    note: "Most reliable on the forced-emit path in our measurements. Unavailable under zero data retention.",
  },
  { id: "claude-opus-5", label: "opus-5" },
  {
    id: "claude-sonnet-5",
    label: "sonnet-5",
    note: "Weakest on the forced-emit path in our measurements — expect validation retries.",
  },
  { id: "claude-opus-4-8", label: "opus-4-8" },
  { id: "claude-sonnet-4-6", label: "sonnet-4-6" },
  { id: "claude-haiku-4-5", label: "haiku-4-5" },
];

export function isAgentModel(v: unknown): v is AgentModel {
  return typeof v === "string" && AGENT_MODEL_CHOICES.some((c) => c.id === v);
}

/**
 * Resolve a caller-supplied model id, falling back rather than throwing — a stale
 * id stored on a client shouldn't brick the run. Mirrors `resolveModel` in
 * community-engine's story composer.
 */
export function resolveAgentModel(requested: unknown, fallback: AgentModel): AgentModel {
  return isAgentModel(requested) ? requested : fallback;
}

/**
 * Newer models reject the (now-deprecated) sampling params — sending `temperature`
 * is a 400 ("temperature is deprecated for this model"). It is removed on Fable 5,
 * Opus 5, Sonnet 5 and Opus 4.8; only Sonnet 4.6 and Haiku 4.5 still accept it.
 * Written as an allowlist so a newly added model defaults to omitting temperature
 * rather than erroring on the first run. Callers should omit it when this is false.
 */
export function supportsTemperature(model: string): boolean {
  return /sonnet-4-6|haiku-4-5/.test(model);
}
