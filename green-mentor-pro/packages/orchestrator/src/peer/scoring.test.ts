import { describe, expect, it } from "vitest";
import {
  businessSimilarity,
  marketSimilarity,
  overallScore,
  revenueSimilarity,
  shareWeights,
  type ActivityShare,
  type MarketsProfile,
} from "./scoring";

const act = (nicCode: string, divisionCode: string | null, turnover: number): ActivityShare => ({
  nicCode,
  divisionCode,
  turnover,
});

describe("shareWeights", () => {
  it("normalizes percent-style shares to fractions", () => {
    const w = shareWeights([act("23941", "23", 60), act("20119", "20", 40)], (a) => a.divisionCode);
    expect(w.get("23")).toBeCloseTo(0.6);
    expect(w.get("20")).toBeCloseTo(0.4);
  });

  it("normalizes fraction-style shares the same way", () => {
    const w = shareWeights([act("23941", "23", 0.6), act("20119", "20", 0.4)], (a) => a.divisionCode);
    expect(w.get("23")).toBeCloseTo(0.6);
  });

  it("drops null keys and non-positive shares", () => {
    const w = shareWeights([act("23941", null, 50), act("20119", "20", 0)], (a) => a.divisionCode);
    expect(w.size).toBe(0);
  });
});

describe("businessSimilarity", () => {
  it("scores identical activity vectors 100", () => {
    const a = [act("23941", "23", 70), act("20119", "20", 30)];
    expect(businessSimilarity(a, a)).toBe(100);
  });

  it("scores disjoint divisions 0", () => {
    expect(businessSimilarity([act("23941", "23", 100)], [act("62011", "62", 100)])).toBe(0);
  });

  it("weights partial overlap by turnover share, mixed percent/fraction filers", () => {
    // A: 70% cement (23), 30% chemicals (20) — filed as percents.
    // B: 100% cement (23) — filed as a fraction. Division overlap = 0.7; NIC
    // group overlap (239 vs 239) = 0.7 → 0.6*0.7 + 0.4*0.7 = 70.
    const a = [act("23941", "23", 70), act("20119", "20", 30)];
    const b = [act("23951", "23", 1)];
    expect(businessSimilarity(a, b)).toBe(70);
  });

  it("distinguishes same division, different NIC group", () => {
    // Same division 23 but group 239 vs 231 → division overlap 1, group overlap 0.
    const score = businessSimilarity([act("23941", "23", 100)], [act("23101", "23", 100)]);
    expect(score).toBe(60);
  });

  it("returns null when neither side has usable codes", () => {
    expect(businessSimilarity([act("", null, 100)], [act("23941", "23", 100)])).toBeNull();
  });
});

describe("revenueSimilarity", () => {
  it("scores equal revenue 100", () => {
    expect(revenueSimilarity(5000, 5000)).toBe(100);
  });

  it("scores 10x apart 50 and >=100x apart 0", () => {
    expect(revenueSimilarity(1000, 10000)).toBe(50);
    expect(revenueSimilarity(10, 1000)).toBe(0);
    expect(revenueSimilarity(1, 100000)).toBe(0);
  });

  it("is symmetric and null-safe", () => {
    expect(revenueSimilarity(200, 800)).toBe(revenueSimilarity(800, 200));
    expect(revenueSimilarity(null, 800)).toBeNull();
    expect(revenueSimilarity(0, 800)).toBeNull();
  });
});

describe("marketSimilarity", () => {
  const base: MarketsProfile = {
    plantsNational: 4,
    officesNational: 10,
    plantsInternational: 0,
    officesInternational: 0,
    statesServed: 20,
    countriesServed: 1,
    exportsPctTurnover: 5,
  };

  it("scores an identical footprint 100", () => {
    expect(marketSimilarity(base, { ...base })).toBe(100);
  });

  it("penalizes domestic vs exporter", () => {
    const exporter: MarketsProfile = {
      ...base,
      plantsInternational: 3,
      countriesServed: 40,
      exportsPctTurnover: 60,
    };
    const score = marketSimilarity(base, exporter);
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(60);
  });

  it("returns null when either side has no filed markets data", () => {
    expect(marketSimilarity(base, null)).toBeNull();
    const empty: MarketsProfile = {
      plantsNational: null,
      officesNational: null,
      plantsInternational: null,
      officesInternational: null,
      statesServed: null,
      countriesServed: null,
      exportsPctTurnover: null,
    };
    // No overlapping components → not comparable from filings.
    expect(marketSimilarity(base, empty)).toBeNull();
  });
});

describe("overallScore", () => {
  it("redistributes weight when market is null", () => {
    expect(overallScore({ business: 80, revenue: 80, market: null })).toBe(80);
  });

  it("weights business 0.5 / revenue 0.25 / market 0.25 when all present", () => {
    expect(overallScore({ business: 100, revenue: 0, market: 0 })).toBe(50);
  });

  it("returns null when nothing is computable", () => {
    expect(overallScore({ business: null, revenue: null, market: null })).toBeNull();
  });
});
