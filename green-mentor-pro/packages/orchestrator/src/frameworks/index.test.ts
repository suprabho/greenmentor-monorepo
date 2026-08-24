import { describe, expect, it } from "vitest";
import { normalizeNicCodes, normalizeFrameworks, scopeFromNicCodes, ALL_FRAMEWORKS } from "./index";
import { fetchMsciForNic } from "./msci";
import { resolveNic } from "../nic/sector";

/**
 * Pure-logic coverage for the nic-framework-materiality grounding layer. The SASB
 * and Sustainalytics arms need Supabase, so they are exercised through the Studio's
 * /api/frameworks/materiality-preview route rather than here; the MSCI arm is
 * committed TypeScript and fully testable in-process, which is also what makes it
 * the best guard on the Division→Section widening the other two share.
 */

describe("normalizeNicCodes", () => {
  it("strips non-digits, dedupes and preserves order", () => {
    expect(normalizeNicCodes([" 20119 ", "19-201", "20119"])).toEqual(["20119", "19201"]);
  });

  it("accepts numbers, since JSON callers send NIC codes both ways", () => {
    expect(normalizeNicCodes([20119, "05101"])).toEqual(["20119", "05101"]);
  });

  it("drops empties and non-codes", () => {
    expect(normalizeNicCodes(["", "  ", "abc", null as unknown as string, "2011"])).toEqual(["2011"]);
  });

  it("clamps to the cap", () => {
    const codes = Array.from({ length: 20 }, (_, i) => `${20000 + i}`);
    expect(normalizeNicCodes(codes)).toHaveLength(10);
    expect(normalizeNicCodes(codes, 2)).toEqual(["20000", "20001"]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeNicCodes(undefined)).toEqual([]);
    expect(normalizeNicCodes("20119")).toEqual([]);
  });
});

describe("normalizeFrameworks", () => {
  it("defaults to all three when absent, empty or entirely unknown", () => {
    expect(normalizeFrameworks(undefined)).toEqual([...ALL_FRAMEWORKS]);
    expect(normalizeFrameworks([])).toEqual([...ALL_FRAMEWORKS]);
    expect(normalizeFrameworks(["gri", "tcfd"])).toEqual([...ALL_FRAMEWORKS]);
  });

  it("keeps a requested subset, case-insensitively, in canonical order", () => {
    expect(normalizeFrameworks(["MSCI", " sasb "])).toEqual(["sasb", "msci"]);
  });

  it("drops unknown names alongside known ones", () => {
    expect(normalizeFrameworks(["sasb", "gri"])).toEqual(["sasb"]);
  });
});

describe("scopeFromNicCodes", () => {
  it("reduces codes to their Division and Section, deduping shared Divisions", () => {
    const scope = scopeFromNicCodes(["20119", "20299"]);
    expect(scope.divisions).toEqual([
      { code: "20", title: "Manufacture of chemicals and chemical products", section: "C" },
    ]);
    expect(scope.sections).toEqual([{ letter: "C", title: "Manufacturing" }]);
    expect(scope.unresolved).toEqual([]);
  });

  it("keeps distinct Divisions under one Section separate", () => {
    const scope = scopeFromNicCodes(["19201", "20119"]);
    expect(scope.divisions.map((d) => d.code)).toEqual(["19", "20"]);
    expect(scope.sections).toHaveLength(1);
  });

  it("surfaces codes that resolve to no Division instead of dropping them", () => {
    const scope = scopeFromNicCodes(["20119", "0", "04999"]);
    expect(scope.divisions.map((d) => d.code)).toEqual(["20"]);
    expect(scope.unresolved).toEqual(["0", "04999"]);
  });

  it("recovers a dropped leading zero, as BRSR filers report it", () => {
    // resolveNic repads only when the leading two digits are not themselves a
    // Division: "8999" is really 08999 (other mining), and there is no Division 89.
    expect(resolveNic("8999")?.divisionCode).toBe("08");
    expect(scopeFromNicCodes(["8999"]).divisions[0].section).toBe("B");
    // ...and does not repad a code whose leading two digits already resolve —
    // "1113" stays Division 11, it is not silently re-read as 01.
    expect(scopeFromNicCodes(["1113"]).divisions[0].code).toBe("11");
  });
});

describe("fetchMsciForNic", () => {
  it("matches GICS sub-industries at the NIC Division and weights their Key Issues", () => {
    const r = fetchMsciForNic(["20"], ["C"]);
    expect(r.framework).toBe("msci");
    expect(r.matched.length).toBeGreaterThan(0);
    expect(r.matched.every((m) => m.matchLevel === "division")).toBe(true);
    expect(r.note).toBeNull();

    const carbon = r.issues.find((i) => i.code === "carbon-emissions");
    expect(carbon).toBeDefined();
    expect(carbon!.pillar).toBe("environmental");
    expect(carbon!.avgWeight).toBeGreaterThan(0);
    expect(carbon!.maxWeight).toBeGreaterThanOrEqual(carbon!.avgWeight);
  });

  it("sorts issues by descending average weight — the prioritisation signal", () => {
    const weights = fetchMsciForNic(["20"], ["C"]).issues.map((i) => i.avgWeight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it("averages only over the sub-industries that weight an issue, not all matched", () => {
    // Packaging Material & Waste is weighted by the consumer-goods sub-industries
    // in NIC 20 but not the industrial ones; diluting by the full matched set
    // would understate it. industry_count records how many actually weight it.
    const r = fetchMsciForNic(["20"], ["C"]);
    const packaging = r.issues.find((i) => i.code === "packaging-material-waste");
    expect(packaging).toBeDefined();
    expect(packaging!.industries.length).toBeLessThan(r.matched.length);
    expect(packaging!.avgWeight).toBeGreaterThan(5);
  });

  it("widens to the NIC Section when no sub-industry maps to the Division", () => {
    // NIC 33 (repair/installation of machinery) has no GICS sub-industry of its own.
    const r = fetchMsciForNic(["33"], ["C"]);
    expect(r.matched.length).toBeGreaterThan(0);
    expect(r.matched.every((m) => m.matchLevel === "section")).toBe(true);
    expect(r.note).toMatch(/wider NIC Section/);
  });

  it("keeps a matched Division precise while widening only the unmatched Section", () => {
    // 20 matches directly; 84 (public administration, Section O) matches nothing —
    // the Division hit must not be widened along with it.
    const r = fetchMsciForNic(["20", "84"], ["C", "O"]);
    expect(r.matched.length).toBeGreaterThan(0);
    expect(r.matched.every((m) => m.matchLevel === "division")).toBe(true);
    expect(r.matched.every((m) => m.nicSection === "C")).toBe(true);
  });

  it("reports no coverage rather than guessing when nothing crosswalks", () => {
    const r = fetchMsciForNic(["97"], ["T"]);
    expect(r.matched).toEqual([]);
    expect(r.issues).toEqual([]);
    expect(r.note).toMatch(/no GICS sub-industry crosswalks/);
  });

  it("stamps the weight vintage so a stale capture is visible downstream", () => {
    expect(fetchMsciForNic(["20"], ["C"]).asOf).toMatch(/\d{4}/);
  });
});
