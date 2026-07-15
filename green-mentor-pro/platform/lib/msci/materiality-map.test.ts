import { describe, it, expect } from "vitest";
import {
  MSCI_THEMES,
  MSCI_KEY_ISSUES,
  MSCI_KEY_ISSUE_BY_ID,
  MSCI_PILLARS,
  MSCI_TOTALS,
  MSCI_SECTORS,
  MSCI_SUBINDUSTRIES,
  MSCI_INDUSTRIES,
  MSCI_INDUSTRY_BY_GICS,
  WEIGHTED_ISSUE_ORDER,
  MSCI_WEIGHT_COLUMNS,
  keyIssueWeights,
} from "./materiality-map";

describe("MSCI materiality map — taxonomy", () => {
  it("has the expected totals (3 pillars / 10 themes / 34 issues, 28 weighted; 11 sectors / 163 sub-industries)", () => {
    expect(MSCI_TOTALS).toEqual({
      pillars: 3,
      themes: 10,
      keyIssues: 34,
      weightedKeyIssues: 28,
      sectors: 11,
      subIndustries: 163,
    });
  });

  it("uses MSCI's three canonical pillars", () => {
    expect([...MSCI_PILLARS]).toEqual(["environmental", "social", "governance"]);
    for (const k of MSCI_KEY_ISSUES) expect(MSCI_PILLARS).toContain(k.pillar);
  });

  it("gives every Key Issue a unique, resolvable slug id", () => {
    const ids = MSCI_KEY_ISSUES.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(MSCI_KEY_ISSUE_BY_ID.get(id)?.id).toBe(id);
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("keeps each Key Issue's theme/pillar consistent with its theme grouping", () => {
    for (const theme of MSCI_THEMES) {
      expect(theme.keyIssues.length).toBeGreaterThan(0);
      for (const k of theme.keyIssues) {
        expect(k.theme).toBe(theme.name);
        expect(k.pillar).toBe(theme.pillar);
      }
    }
  });

  it("weights 13 Environmental + 14 Social + 1 Governance Key Issue", () => {
    const weighted = MSCI_KEY_ISSUES.filter((k) => k.weightIndex !== null);
    const by = (p: string) => weighted.filter((k) => k.pillar === p).length;
    expect(by("environmental")).toBe(13);
    expect(by("social")).toBe(14);
    expect(by("governance")).toBe(1);
    expect(weighted.length).toBe(MSCI_WEIGHT_COLUMNS);
  });
});

describe("MSCI materiality map — weight matrix", () => {
  it("aligns WEIGHTED_ISSUE_ORDER to weightIndex positions", () => {
    expect(WEIGHTED_ISSUE_ORDER.length).toBe(MSCI_WEIGHT_COLUMNS);
    WEIGHTED_ISSUE_ORDER.forEach((id, col) => {
      const issue = MSCI_KEY_ISSUE_BY_ID.get(id);
      expect(issue).toBeDefined();
      expect(issue?.weightIndex).toBe(col);
    });
  });

  it("gives every industry a full weight vector that sums to ~100", () => {
    for (const ind of MSCI_INDUSTRIES) {
      expect(ind.weights.length).toBe(MSCI_WEIGHT_COLUMNS);
      const sum = ind.weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(99);
      expect(sum).toBeLessThan(101);
    }
  });

  it("attaches a matching relevance vector to sub-industries only", () => {
    for (const s of MSCI_SUBINDUSTRIES) expect(s.relevance.length).toBe(MSCI_WEIGHT_COLUMNS);
    for (const s of MSCI_SECTORS) expect(s.relevance.length).toBe(0);
  });

  it("keys industries by a unique GICS code (2-digit sectors, 8-digit sub-industries)", () => {
    expect(MSCI_INDUSTRY_BY_GICS.size).toBe(MSCI_INDUSTRIES.length);
    for (const s of MSCI_SECTORS) expect(s.gicsCode).toMatch(/^\d{2}$/);
    for (const s of MSCI_SUBINDUSTRIES) {
      expect(s.gicsCode).toMatch(/^\d{8}$/);
      expect(s.sectorCode).toBe(s.gicsCode.slice(0, 2));
    }
  });

  it("keyIssueWeights returns only material issues, resolved and sorted by weight", () => {
    const energy = MSCI_INDUSTRY_BY_GICS.get("10"); // Energy sector
    expect(energy).toBeDefined();
    const rows = keyIssueWeights(energy!);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.weight).toBeGreaterThan(0);
      expect(MSCI_KEY_ISSUE_BY_ID.has(r.issue.id)).toBe(true);
    }
    const weights = rows.map((r) => r.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    // Energy is carbon-intensive → Carbon Emissions must surface as a material Key Issue.
    expect(rows.some((r) => r.issue.id === "carbon-emissions")).toBe(true);
  });
});
