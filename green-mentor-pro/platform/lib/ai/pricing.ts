// Model cost → credits. Pure functions, no I/O — safe to unit test and to import
// from anywhere. The ledger side lives in lib/ai/usage.ts.
//
// 1 credit = ₹1 (PRD §7), so `credits` here is a rupee figure:
//   credits = (token cost in USD) × AI_USD_INR × AI_CREDIT_MARGIN

import type { LanguageModelUsage } from "ai";

/**
 * USD per 1M tokens, from the Anthropic pricing table (rates checked 2026-07-29).
 * Keys are matched as a prefix against the *normalised* model id, so one entry
 * covers both the direct id the agents use (`claude-sonnet-4-6`) and the AI
 * Gateway id ESG Buddy resolves to (`anthropic/claude-sonnet-4.5` → normalised to
 * `claude-sonnet-4-5`). Longest key wins, so `claude-opus-5` never shadows
 * `claude-opus-4-8`.
 */
const RATES: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  // Sonnet 5 carries introductory pricing of $2/$10 through 2026-08-31; the sticker
  // rate is used here so cost is over- rather than under-estimated while that runs.
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * Applied when a model id matches nothing in RATES. Set to the most expensive
 * known tier on purpose: an unrecognised model is far more likely to be a newer,
 * pricier one than a cheaper one, and over-stating cost is the safe direction for
 * a table that exists to inform pricing. Rows priced this way are tagged
 * `priced = 'fallback'` so they can be excluded or re-priced later.
 */
const FALLBACK_RATE = { input: 10, output: 50 };

// Cache reads bill at ~0.1x the base input rate; writes at 1.25x for the default
// 5-minute TTL (2x for 1h, which nothing here uses).
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

/** ₹ per $1. Override per-env as the rate moves; the default is a round figure. */
export function usdToInrRate(): number {
  const n = Number(process.env.AI_USD_INR);
  return Number.isFinite(n) && n > 0 ? n : 88;
}

/**
 * Gross-up applied to provider cost to get the credit price. 1.5 = a 33% margin on
 * the credit price. This is the single knob for AI-run unit economics.
 */
export function creditMargin(): number {
  const n = Number(process.env.AI_CREDIT_MARGIN);
  return Number.isFinite(n) && n > 0 ? n : 1.5;
}

/**
 * Strip the gateway's `provider/` prefix and normalise the version separator, so
 * `anthropic/claude-sonnet-4.5` and `claude-sonnet-4-5` land on the same key.
 */
function normaliseModelId(modelId: string): string {
  const bare = modelId.includes("/") ? modelId.slice(modelId.lastIndexOf("/") + 1) : modelId;
  return bare.toLowerCase().replace(/\./g, "-");
}

function rateFor(modelId: string): { rate: { input: number; output: number }; priced: "table" | "fallback" } {
  const key = normaliseModelId(modelId);
  // Longest match first so a shorter id can't shadow a more specific one.
  const match = Object.keys(RATES)
    .sort((a, b) => b.length - a.length)
    .find((k) => key.startsWith(k));
  return match ? { rate: RATES[match], priced: "table" } : { rate: FALLBACK_RATE, priced: "fallback" };
}

/** Token counts normalised out of the AI SDK's LanguageModelUsage. */
export interface TokenCounts {
  /** Input tokens billed at the full rate (i.e. excluding cache reads/writes). */
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

/**
 * Pull token counts out of an AI SDK usage object.
 *
 * `usage.inputTokens` is the TOTAL input including cached tokens, while
 * `inputTokenDetails` breaks it down. Pricing the total at the full rate on top of
 * the cached portions would double-count, so the full-rate figure is taken from
 * `noCacheTokens` and only derived by subtraction when the provider omits details.
 * Every field is `number | undefined` in the SDK type.
 */
export function tokenCountsFromUsage(usage: LanguageModelUsage | undefined): TokenCounts {
  const details = usage?.inputTokenDetails;
  const cacheReadTokens = details?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0;
  const cacheWriteTokens = details?.cacheWriteTokens ?? 0;
  const totalInput = usage?.inputTokens ?? 0;
  const inputTokens =
    details?.noCacheTokens ?? Math.max(0, totalInput - cacheReadTokens - cacheWriteTokens);

  return {
    inputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage?.outputTokens ?? 0,
    reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0,
  };
}

export interface PricedUsage extends TokenCounts {
  model: string;
  priced: "table" | "fallback";
  costUsd: number;
  costInr: number;
  /** Metered credits, un-rounded. Round up only at the point of charging. */
  credits: number;
}

/** Price a set of token counts for a model. */
export function priceTokens(modelId: string, counts: TokenCounts): PricedUsage {
  const { rate, priced } = rateFor(modelId);
  const perToken = (n: number, usdPerMillion: number) => (n / 1_000_000) * usdPerMillion;

  const costUsd =
    perToken(counts.inputTokens, rate.input) +
    perToken(counts.cacheReadTokens, rate.input * CACHE_READ_MULTIPLIER) +
    perToken(counts.cacheWriteTokens, rate.input * CACHE_WRITE_MULTIPLIER) +
    perToken(counts.outputTokens, rate.output);

  const costInr = costUsd * usdToInrRate();
  return { ...counts, model: modelId, priced, costUsd, costInr, credits: costInr * creditMargin() };
}

/** Convenience: AI SDK usage object → priced usage. */
export function priceUsage(modelId: string, usage: LanguageModelUsage | undefined): PricedUsage {
  return priceTokens(modelId, tokenCountsFromUsage(usage));
}

/**
 * Credits actually debited for a metered call. Rounded UP so a sub-rupee call still
 * costs something — a chat message that costs ₹0.30 must not be free, or the free
 * allowance stops being the thing that bounds free usage.
 */
export function chargeableCredits(credits: number): number {
  return credits > 0 ? Math.ceil(credits) : 0;
}
