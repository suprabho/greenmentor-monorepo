import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { LanguageModelUsage } from "ai";
import { chargeableCredits, priceTokens, priceUsage, tokenCountsFromUsage } from "./pricing";

// pricing.ts is pure, but reads two env knobs at call time. Pin them so the
// expected numbers below are exact rather than dependent on deployment config.
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env.AI_USD_INR = "80";
  process.env.AI_CREDIT_MARGIN = "1.5";
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Build a LanguageModelUsage with the AI SDK's nested detail shape. */
function usage(partial: {
  inputTokens?: number;
  noCacheTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}): LanguageModelUsage {
  return {
    inputTokens: partial.inputTokens,
    inputTokenDetails: {
      noCacheTokens: partial.noCacheTokens,
      cacheReadTokens: partial.cacheReadTokens,
      cacheWriteTokens: partial.cacheWriteTokens,
    },
    outputTokens: partial.outputTokens,
    outputTokenDetails: { textTokens: undefined, reasoningTokens: partial.reasoningTokens },
    totalTokens: undefined,
  } as LanguageModelUsage;
}

describe("tokenCountsFromUsage", () => {
  it("prefers the provider's noCacheTokens over subtracting from the total", () => {
    const counts = tokenCountsFromUsage(
      usage({ inputTokens: 1000, noCacheTokens: 200, cacheReadTokens: 700, cacheWriteTokens: 100 }),
    );
    expect(counts).toMatchObject({ inputTokens: 200, cacheReadTokens: 700, cacheWriteTokens: 100 });
  });

  it("derives the full-rate input by subtraction when details are absent", () => {
    // inputTokens is the TOTAL including cached tokens — pricing it as-is on top of
    // the cache lines would double-count the cached portion.
    const counts = tokenCountsFromUsage(usage({ inputTokens: 1000, cacheReadTokens: 900 }));
    expect(counts.inputTokens).toBe(100);
    expect(counts.cacheReadTokens).toBe(900);
  });

  it("never returns a negative input count when the provider's numbers disagree", () => {
    const counts = tokenCountsFromUsage(usage({ inputTokens: 100, cacheReadTokens: 900 }));
    expect(counts.inputTokens).toBe(0);
  });

  it("treats missing usage as all zeroes", () => {
    expect(tokenCountsFromUsage(undefined)).toEqual({
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    });
  });

  it("reads reasoning tokens from the nested details", () => {
    expect(tokenCountsFromUsage(usage({ outputTokens: 500, reasoningTokens: 300 })).reasoningTokens).toBe(300);
  });
});

describe("priceTokens", () => {
  const zero = { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0 };

  it("prices Sonnet at $3/$15 per Mtok and converts to credits", () => {
    // 1M in + 1M out = $3 + $15 = $18 → ₹1440 at 80 → 2160 credits at 1.5x.
    const p = priceTokens("claude-sonnet-4-6", { ...zero, inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(p.costUsd).toBeCloseTo(18, 6);
    expect(p.costInr).toBeCloseTo(1440, 4);
    expect(p.credits).toBeCloseTo(2160, 4);
    expect(p.priced).toBe("table");
  });

  it("prices Opus 4.8 at the $5/$25 tier, not the fallback", () => {
    const p = priceTokens("claude-opus-4-8", { ...zero, inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(p.costUsd).toBeCloseTo(30, 6);
    expect(p.priced).toBe("table");
  });

  it("does not let a shorter model key shadow a longer one", () => {
    // 'claude-opus-4-8' must win over a bare 'claude-opus-' style prefix match.
    const opus48 = priceTokens("claude-opus-4-8", { ...zero, outputTokens: 1_000_000 });
    const opus5 = priceTokens("claude-opus-5", { ...zero, outputTokens: 1_000_000 });
    expect(opus48.costUsd).toBeCloseTo(25, 6);
    expect(opus5.costUsd).toBeCloseTo(25, 6);
  });

  it("normalises the AI Gateway's provider prefix and dotted version", () => {
    // resolveBuddyModel's gateway default is "anthropic/claude-sonnet-4.5".
    const gateway = priceTokens("anthropic/claude-sonnet-4.5", { ...zero, outputTokens: 1_000_000 });
    expect(gateway.priced).toBe("table");
    expect(gateway.costUsd).toBeCloseTo(15, 6);
  });

  it("discounts cache reads and surcharges cache writes against the input rate", () => {
    // Haiku input is $1/Mtok: reads at 0.1x = $0.10, writes at 1.25x = $1.25.
    const reads = priceTokens("claude-haiku-4-5", { ...zero, cacheReadTokens: 1_000_000 });
    const writes = priceTokens("claude-haiku-4-5", { ...zero, cacheWriteTokens: 1_000_000 });
    expect(reads.costUsd).toBeCloseTo(0.1, 6);
    expect(writes.costUsd).toBeCloseTo(1.25, 6);
  });

  it("falls back to the most expensive known rate for an unknown model", () => {
    // Unknown ids are more likely to be newer/pricier, so cost must not be understated.
    const p = priceTokens("some-future-model-9", { ...zero, inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(p.priced).toBe("fallback");
    expect(p.costUsd).toBeCloseTo(60, 6);
  });

  it("honours the env-configured FX rate and margin", () => {
    process.env.AI_USD_INR = "100";
    process.env.AI_CREDIT_MARGIN = "2";
    const p = priceTokens("claude-haiku-4-5", { ...zero, outputTokens: 1_000_000 }); // $5
    expect(p.costInr).toBeCloseTo(500, 4);
    expect(p.credits).toBeCloseTo(1000, 4);
  });

  it("falls back to sane defaults when the env knobs are junk", () => {
    process.env.AI_USD_INR = "not-a-number";
    process.env.AI_CREDIT_MARGIN = "0";
    const p = priceTokens("claude-haiku-4-5", { ...zero, outputTokens: 1_000_000 }); // $5
    expect(p.costInr).toBeCloseTo(440, 4); // default 88
    expect(p.credits).toBeCloseTo(660, 4); // default 1.5x
  });
});

describe("priceUsage", () => {
  it("prices straight off an AI SDK usage object", () => {
    const p = priceUsage("claude-sonnet-4-6", usage({ noCacheTokens: 1_000_000, outputTokens: 1_000_000 }));
    expect(p.costUsd).toBeCloseTo(18, 6);
  });
});

describe("chargeableCredits", () => {
  it("rounds a sub-credit call up so it is never free", () => {
    expect(chargeableCredits(0.3)).toBe(1);
    expect(chargeableCredits(1.01)).toBe(2);
  });

  it("charges nothing for zero usage", () => {
    expect(chargeableCredits(0)).toBe(0);
  });
});
