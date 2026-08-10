import { describe, it, expect } from "vitest";
import {
  MSCI_NIC_CROSSWALK,
  CROSSWALK_BY_GICS,
  GICS_BY_NIC_DIVISION,
} from "./nic-crosswalk";
import { MSCI_SUBINDUSTRIES, MSCI_INDUSTRY_BY_GICS, MSCI_TOTALS } from "./materiality-map";
import { resolveNic } from "../brsr/nic-sector";

describe("GICS → NIC crosswalk — coverage", () => {
  it("maps exactly the MSCI sub-industry set (a re-scrape that changes it fails here, naming codes)", () => {
    const mapped = new Set(MSCI_NIC_CROSSWALK.map((e) => e.gics));
    const expected = new Set(MSCI_SUBINDUSTRIES.map((s) => s.gicsCode));
    const missing = [...expected].filter((g) => !mapped.has(g));
    const extra = [...mapped].filter((g) => !expected.has(g));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    expect(MSCI_NIC_CROSSWALK.length).toBe(MSCI_TOTALS.subIndustries);
  });

  it("has no duplicate GICS codes", () => {
    expect(CROSSWALK_BY_GICS.size).toBe(MSCI_NIC_CROSSWALK.length);
  });

  it("keys every entry by a valid 8-digit sub-industry code (never a sector)", () => {
    for (const e of MSCI_NIC_CROSSWALK) {
      expect(e.gics).toMatch(/^\d{8}$/);
      expect(MSCI_INDUSTRY_BY_GICS.get(e.gics)?.level).toBe("sub-industry");
    }
  });
});

describe("GICS → NIC crosswalk — NIC integrity", () => {
  it("uses only real NIC divisions, each under its intended section (typo tripwire)", () => {
    for (const e of MSCI_NIC_CROSSWALK) {
      expect(e.division).toMatch(/^\d{2}$/);
      const nic = resolveNic(e.division);
      expect(nic, `unknown NIC division ${e.division} (gics ${e.gics})`).not.toBeNull();
      expect(nic?.divisionCode).toBe(e.division);
      expect(
        nic?.sectionLetter,
        `gics ${e.gics}: division ${e.division} is in Section ${nic?.sectionLetter}, not ${e.section}`,
      ).toBe(e.section);
    }
  });

  it("keeps confidence within the three-value domain", () => {
    for (const e of MSCI_NIC_CROSSWALK) {
      expect(["high", "medium", "low"]).toContain(e.confidence);
    }
  });
});

describe("GICS → NIC crosswalk — reverse index", () => {
  it("buckets exactly the mapped codes, each under its own division", () => {
    const flattened = [...GICS_BY_NIC_DIVISION.values()].flat();
    expect(flattened.length).toBe(MSCI_NIC_CROSSWALK.length);
    expect(new Set(flattened).size).toBe(flattened.length);
    for (const [division, codes] of GICS_BY_NIC_DIVISION) {
      expect(resolveNic(division)).not.toBeNull();
      for (const gics of codes) expect(CROSSWALK_BY_GICS.get(gics)?.division).toBe(division);
    }
  });
});
