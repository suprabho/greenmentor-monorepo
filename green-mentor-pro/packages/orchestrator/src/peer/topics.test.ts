import { describe, expect, it } from "vitest";
import { normalizeSymbols, truncateAtWord, type PeerMaterialTopics } from "../db/brsrTopics";
import { peerTopicsForModel } from "./topics";

describe("normalizeSymbols", () => {
  it("uppercases, trims, dedupes and preserves order", () => {
    expect(normalizeSymbols([" reliance ", "ONGC", "ongc", "ioc"])).toEqual(["RELIANCE", "ONGC", "IOC"]);
  });

  it("drops empties and non-strings", () => {
    expect(normalizeSymbols(["", "  ", "TCS", null as unknown as string, 42 as unknown as string])).toEqual(["TCS"]);
  });

  it("clamps to the cap", () => {
    const syms = Array.from({ length: 20 }, (_, i) => `SYM${i}`);
    expect(normalizeSymbols(syms)).toHaveLength(15);
    expect(normalizeSymbols(syms, 3)).toEqual(["SYM0", "SYM1", "SYM2"]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeSymbols(undefined)).toEqual([]);
    expect(normalizeSymbols("RELIANCE")).toEqual([]);
  });
});

describe("truncateAtWord", () => {
  it("passes short strings through untouched", () => {
    expect(truncateAtWord("water scarcity", 300)).toBe("water scarcity");
  });

  it("cuts on a word boundary with an ellipsis", () => {
    const out = truncateAtWord("climate change poses a material transition risk to operations", 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
    // no mid-word cut: the char before the ellipsis ends a whole word
    expect(out).toBe("climate change poses a…");
  });

  it("hard-cuts a single long token rather than returning almost nothing", () => {
    const out = truncateAtWord("a".repeat(100), 20);
    expect(out).toBe("a".repeat(20) + "…");
  });
});

describe("peerTopicsForModel", () => {
  const peer: PeerMaterialTopics = {
    filingId: "f-1",
    symbol: "RELIANCE",
    companyName: "Reliance Industries Limited",
    fy: "2024-25",
    topics: [
      {
        topicRaw: "Climate Change",
        riskOpportunity: "R",
        rationale: "Transition risk from carbon pricing",
        canonicalTopic: "Climate & energy",
        pillarHint: "environment",
        canonConfidence: 0.92,
      },
      {
        topicRaw: "Data Privacy",
        riskOpportunity: null,
        rationale: null,
        canonicalTopic: null,
        pillarHint: null,
        canonConfidence: null,
      },
    ],
  };

  it("maps to the snake_case tool payload with a filing source ref", () => {
    const out = peerTopicsForModel(peer);
    expect(out).toEqual({
      symbol: "RELIANCE",
      name: "Reliance Industries Limited",
      fy: "2024-25",
      topic_count: 2,
      topics: [
        {
          topic: "Climate Change",
          risk_opportunity: "R",
          rationale: "Transition risk from carbon pricing",
          canon: { topic: "Climate & energy", pillar: "environment", confidence: 0.92 },
        },
        { topic: "Data Privacy", risk_opportunity: null, rationale: null, canon: null },
      ],
      source: { kind: "brsr", ref: "NSE BRSR filing RELIANCE FY 2024-25" },
    });
  });

  it("does not leak the topic_norm join key", () => {
    const out = peerTopicsForModel(peer) as { topics: Record<string, unknown>[] };
    for (const t of out.topics) expect("topic_norm" in t).toBe(false);
  });
});
