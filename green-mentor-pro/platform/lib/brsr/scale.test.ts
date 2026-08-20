import { describe, expect, it } from "vitest";
import { anchorLogOf, inferScale, isUsable, PLAUSIBLE_FLOOR } from "./scale";

/**
 * Fixtures are real filings, named, so a future taxonomy or threshold change is
 * checked against the population that motivated the rule rather than invented
 * numbers. Values as stored in brsr_indicators at the time of writing.
 */
describe("inferScale", () => {
  it("leaves a plausible value untouched", () => {
    // PAGEIND FY2025 — filed in rupees, nothing to do.
    expect(inferScale({ filed: 52467758757, crossTag: 52467758757, anchorLog: 10.7 })).toEqual({
      multiplier: 1,
      source: "as_filed",
      confidence: "high",
    });
  });

  it("recovers lakh from both signals agreeing", () => {
    // SAKSOFT FY2025: Turnover 49262.57, TotalRevenueOfTheCompany 4926257426.95.
    // Anchor from its own healthy years (~2.25e9 - 4.32e9).
    const v = inferScale({ filed: 49262.57, crossTag: 4926257426.95, anchorLog: Math.log10(4.32e9) });
    expect(v).toEqual({ multiplier: 1e5, source: "both", confidence: "high" });
    expect(49262.57 * v.multiplier).toBeCloseTo(4926257000, -4);
  });

  it("recovers crore from the cross-year anchor alone", () => {
    // TAJGVK FY2023 filed 4.11e2 against a 4.12e9 anchor — 1e7, crore.
    expect(inferScale({ filed: 4.11e2, crossTag: null, anchorLog: Math.log10(4.12e9) })).toEqual({
      multiplier: 1e7,
      source: "cross_year",
      confidence: "medium",
    });
  });

  it("recovers from the cross-tag alone when the company has no anchor", () => {
    // The un-anchored case: every year is mis-scaled, so only the in-filing pair
    // can speak. Multipliers measured for these clustered on 1e7.
    expect(inferScale({ filed: 300, crossTag: 3.0e9, anchorLog: null })).toEqual({
      multiplier: 1e7,
      source: "cross_tag",
      confidence: "medium",
    });
  });

  it("refuses when the gap is not a real unit multiplier", () => {
    // DALBHARAT FY2022 filed 1.32e2 against a ~1.47e11 anchor. That is a 1e9 gap:
    // not lakh, not crore, so it is corruption of some other kind. Do not guess.
    expect(inferScale({ filed: 1.32e2, crossTag: null, anchorLog: Math.log10(1.47e11) })).toEqual({
      multiplier: 1,
      source: "unresolved",
      confidence: "unresolved",
    });
  });

  it("does not rescale a genuinely small company", () => {
    // SUVEN FY2025 filed 7.11e7 — under the floor, but only ~0.25 dex from its own
    // 1.26e8 anchor. The right answer is "no change", not a rescale.
    expect(inferScale({ filed: 7.11e7, crossTag: null, anchorLog: Math.log10(1.26e8) })).toEqual({
      multiplier: 1,
      source: "as_filed",
      confidence: "high",
    });
  });

  it("ignores a cross-tag that is itself below the floor", () => {
    // PARAS FY2025 files BOTH tags as 41654.41 — the filer used lakh throughout,
    // so their agreement carries no unit information. With no anchor either, the
    // only honest answer is unresolved.
    expect(inferScale({ filed: 41654.41, crossTag: 41654.41, anchorLog: null })).toEqual({
      multiplier: 1,
      source: "unresolved",
      confidence: "unresolved",
    });
  });

  it("falls back to the anchor when the cross-tag is uninformative", () => {
    // Same PARAS shape, but the company has a healthy year (FY2023 2.32e9) to
    // anchor against — 41654.41 * 1e5 = 4.17e9, a 1e5 snap.
    expect(inferScale({ filed: 41654.41, crossTag: 41654.41, anchorLog: Math.log10(2.32e9) })).toEqual({
      multiplier: 1e5,
      source: "cross_year",
      confidence: "medium",
    });
  });

  it("refuses when the two signals conflict", () => {
    // cross-tag implies 1e5, anchor implies 1e7 — no winner, so no correction.
    expect(inferScale({ filed: 1e4, crossTag: 1e9, anchorLog: 11 })).toEqual({
      multiplier: 1,
      source: "unresolved",
      confidence: "unresolved",
    });
  });

  it("refuses a loose lone signal", () => {
    // Nearest unit multiplier still lands ~0.6 dex out: ALKEM FY2023 (9.75e4 vs a
    // 1e11 anchor) is this shape. Above SINGLE_SIGNAL_TOLERANCE, so unresolved.
    const v = inferScale({ filed: 9.75e4, crossTag: null, anchorLog: 11.0 });
    expect(v.confidence).toBe("unresolved");
    expect(v.multiplier).toBe(1);
  });

  it("treats non-positive turnover as unresolved, not a scale problem", () => {
    // Zero/negative turnover is the fallbackTags case (banks, IDEA's net loss).
    for (const filed of [0, -698562487426]) {
      expect(inferScale({ filed, crossTag: 4.3e11, anchorLog: 11 }).source).toBe("unresolved");
    }
  });
});

/**
 * The floor alone misses a unit error that leaves the value above it, so a value
 * is also checked against its own company's median.
 */
describe("inferScale — above the floor, against the company's own series", () => {
  it("recovers a value that clears the floor but contradicts the series", () => {
    // DALBHARAT FY2021 filed 1.35e9; its other years are 1.47e11 / 1.48e11.
    const v = inferScale({ filed: 1.35e9, crossTag: null, anchorLog: Math.log10(1.47e11) });
    expect(v).toEqual({ multiplier: 1e2, source: "cross_year", confidence: "medium" });
    expect(1.35e9 * v.multiplier).toBeCloseTo(1.35e11, -9);
  });

  it("recovers a 1e3 gap — Rs '000 is a real convention", () => {
    // TCS FY2022 filed 2.25e9 against a ~2.41e12 series.
    expect(inferScale({ filed: 2.25e9, crossTag: null, anchorLog: Math.log10(2.41e12) })).toEqual({
      multiplier: 1e3,
      source: "cross_year",
      confidence: "medium",
    });
  });

  it("flags a contradiction no unit explains, rather than scaling it", () => {
    // SPLPETRO FY2022: 1.08e8 vs a 5.25e10 median — best unit snap is 0.69 dex out.
    expect(inferScale({ filed: 1.08e8, crossTag: null, anchorLog: Math.log10(5.25e10) })).toEqual({
      multiplier: 1,
      source: "inconsistent",
      confidence: "inconsistent",
    });
  });

  it("never rescales a value LARGER than its series — units only shrink", () => {
    // SHAKTIPUMP FY2022 filed 9.30e11 against a 2.64e10 median. Reporting in lakh
    // or crore cannot inflate a number, so this is flagged, never "corrected".
    expect(inferScale({ filed: 9.3e11, crossTag: null, anchorLog: Math.log10(2.64e10) })).toEqual({
      multiplier: 1,
      source: "inconsistent",
      confidence: "inconsistent",
    });
  });

  it("leaves a value consistent with its series alone", () => {
    // SHAKTIPUMP FY2023 (9.23e9) is 0.45 dex from the median — ordinary variation.
    expect(inferScale({ filed: 9.23e9, crossTag: null, anchorLog: Math.log10(2.64e10) })).toEqual({
      multiplier: 1,
      source: "as_filed",
      confidence: "high",
    });
  });

  it("takes both signals agreeing as high confidence above the floor", () => {
    expect(inferScale({ filed: 1.35e9, crossTag: 1.4e11, anchorLog: Math.log10(1.47e11) })).toEqual({
      multiplier: 1e2,
      source: "both",
      confidence: "high",
    });
  });

  it("leaves a plausible value alone when the company has no anchor", () => {
    expect(inferScale({ filed: 5e10, crossTag: null, anchorLog: null })).toEqual({
      multiplier: 1,
      source: "as_filed",
      confidence: "high",
    });
  });

  it("tolerates real growth below the trigger", () => {
    // 20x across a filing window is steep but real; must not be rescaled.
    expect(inferScale({ filed: 1e10, crossTag: null, anchorLog: Math.log10(2e11) }).source).toBe("as_filed");
  });
});

describe("anchorLogOf", () => {
  it("uses only plausible values and takes the median", () => {
    // DALBHARAT: 1.35e9, 1.32e2, 1.47e11, 1.48e11 — the 1.32e2 must not drag it.
    const anchor = anchorLogOf([1.35e9, 1.32e2, 1.47e11, 1.48e11]);
    expect(anchor).not.toBeNull();
    expect(anchor!).toBeGreaterThan(10);
  });

  it("returns null when every year is below the floor", () => {
    expect(anchorLogOf([1.26e2, 4.93e4])).toBeNull();
    expect(anchorLogOf([])).toBeNull();
  });

  it("ignores non-finite values", () => {
    expect(anchorLogOf([Number.NaN, PLAUSIBLE_FLOOR])).toBe(Math.log10(PLAUSIBLE_FLOOR));
  });
});

describe("isUsable", () => {
  it("accepts high and medium, rejects unresolved and inconsistent", () => {
    expect(isUsable("high")).toBe(true);
    expect(isUsable("medium")).toBe(true);
    expect(isUsable("unresolved")).toBe(false);
    // Withheld for a different reason, but equally not to be used as revenue.
    expect(isUsable("inconsistent")).toBe(false);
  });
});
