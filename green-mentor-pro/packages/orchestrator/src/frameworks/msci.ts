import { MSCI_INDUSTRY_BY_GICS, keyIssueWeights, MSCI_AS_OF } from "./msci/materiality-map";
import { MSCI_NIC_CROSSWALK, GICS_BY_NIC_DIVISION, CROSSWALK_BY_GICS } from "./msci/nic-crosswalk";
import type { MatchLevel, MatchedIndustry, CrosswalkConfidence } from "../db/frameworkMateriality";

/**
 * MSCI arm of the nic-framework-materiality grounding tool — the third framework
 * alongside the two Supabase-backed ones in ../db/frameworkMateriality.ts.
 *
 * MSCI keys its ESG Industry Materiality Map by GICS® sub-industry; ./msci/nic-crosswalk.ts
 * maps each of the 163 sub-industries onto a NIC Division, so the fan-out mirrors
 * the SASB / Sustainalytics one — Division first, widening to the NIC Section only
 * where a Division has no mapped sub-industry.
 *
 * ─── PROPRIETARY MSCI REFERENCE DATA — INTERNAL USE ONLY ──────────────────────
 * Unlike SASB and Sustainalytics, whose taxonomies are public, the MSCI map (Key
 * Issue names AND the average weights) is licensed reference data. Runs that
 * include it are internal-use: the agent is required to carry a caveat saying so,
 * and the emitted table must not be published or redistributed. Callers that need
 * a freely shareable table should pass frameworks without "msci".
 *
 * The weights are the reason it earns its place: SASB and Sustainalytics say
 * *whether* an issue is material, MSCI says *how much* it drives an industry's ESG
 * rating — the only prioritisation signal in the three.
 */

export { MSCI_AS_OF };

/** One MSCI Key Issue, unioned across the matched GICS sub-industries. */
export interface MsciIssue {
  /** Key Issue slug id, e.g. "carbon-emissions". */
  code: string;
  name: string;
  description: string | null;
  /** MSCI Theme (e.g. "Climate Change") — the framework's own grouping. */
  grouping: string | null;
  /** MSCI pillar as published: "environmental" | "social" | "governance". */
  pillar: string;
  /** Sub-industry names that weight this Key Issue above zero. */
  industries: string[];
  /**
   * Mean average Key Issue weight (%) across the matched sub-industries that
   * weight it — averaged over those, NOT over all matched, so a genuinely
   * industry-specific issue keeps its magnitude instead of being diluted.
   */
  avgWeight: number;
  /** Highest single-sub-industry weight (%) among the matched set. */
  maxWeight: number;
  /**
   * True when EVERY matched sub-industry marks the issue company-specific
   * (MSCI's "CS" marker) — material only for some companies in the industry.
   */
  companySpecific: boolean;
}

export interface MsciResult {
  framework: "msci";
  matched: MatchedIndustry[];
  issues: MsciIssue[];
  /** Vintage of the weight matrix, e.g. "February 11, 2026". */
  asOf: string;
  note: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Reverse index by NIC Section, for the fallback the Division index can't serve. */
const GICS_BY_NIC_SECTION: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const e of MSCI_NIC_CROSSWALK) {
    const list = m.get(e.section);
    if (list) list.push(e.gics);
    else m.set(e.section, [e.gics]);
  }
  return m;
})();

/**
 * The MSCI Key Issues weighted for the GICS sub-industries that crosswalk to the
 * requested NIC codes. Same Division-then-Section widening as the SASB and
 * Sustainalytics fetches, so the three `matched` lists are directly comparable.
 */
export function fetchMsciForNic(divisions: string[], sections: string[]): MsciResult {
  // Division hits first; widen only the Sections that produced nothing.
  const picked = new Map<string, { gics: string; matchLevel: MatchLevel }>();
  const hitSections = new Set<string>();
  for (const division of divisions) {
    for (const gics of GICS_BY_NIC_DIVISION.get(division) ?? []) {
      if (!picked.has(gics)) picked.set(gics, { gics, matchLevel: "division" });
      const entry = CROSSWALK_BY_GICS.get(gics);
      if (entry) hitSections.add(entry.section);
    }
  }
  for (const section of sections) {
    if (hitSections.has(section)) continue;
    for (const gics of GICS_BY_NIC_SECTION.get(section) ?? []) {
      if (!picked.has(gics)) picked.set(gics, { gics, matchLevel: "section" });
    }
  }

  const matched: MatchedIndustry[] = [];
  for (const { gics, matchLevel } of picked.values()) {
    const industry = MSCI_INDUSTRY_BY_GICS.get(gics);
    const entry = CROSSWALK_BY_GICS.get(gics);
    if (!industry || !entry) continue; // crosswalk and dataset are pinned in sync by the platform vitest suite
    matched.push({
      code: gics,
      name: industry.name,
      sector: industry.sectorCode,
      matchLevel,
      confidence: entry.confidence as CrosswalkConfidence,
      nicDivision: entry.division,
      nicSection: entry.section,
    });
  }

  if (!matched.length) {
    return {
      framework: "msci",
      matched: [],
      issues: [],
      asOf: MSCI_AS_OF,
      note: "no GICS sub-industry crosswalks to these NIC codes",
    };
  }

  // Union the weighted Key Issues across the matched sub-industries.
  const acc = new Map<
    string,
    { issue: MsciIssue; weights: number[]; companySpecificCount: number }
  >();
  for (const m of matched) {
    const industry = MSCI_INDUSTRY_BY_GICS.get(m.code)!;
    for (const { issue, weight, companySpecific } of keyIssueWeights(industry)) {
      const existing = acc.get(issue.id);
      if (existing) {
        if (!existing.issue.industries.includes(industry.name)) existing.issue.industries.push(industry.name);
        existing.weights.push(weight);
        if (companySpecific) existing.companySpecificCount++;
        continue;
      }
      acc.set(issue.id, {
        issue: {
          code: issue.id,
          name: issue.name,
          description: issue.description || null,
          grouping: issue.theme || null,
          pillar: issue.pillar,
          industries: [industry.name],
          avgWeight: 0,
          maxWeight: 0,
          companySpecific: false,
        },
        weights: [weight],
        companySpecificCount: companySpecific ? 1 : 0,
      });
    }
  }

  const issues = [...acc.values()]
    .map(({ issue, weights, companySpecificCount }) => ({
      ...issue,
      avgWeight: round1(weights.reduce((a, b) => a + b, 0) / weights.length),
      maxWeight: round1(Math.max(...weights)),
      companySpecific: companySpecificCount === weights.length,
    }))
    // Weight is the prioritisation signal, so lead with it — unlike the
    // SASB/Sustainalytics union, which can only sort by breadth of coverage.
    .sort((a, b) => b.avgWeight - a.avgWeight || a.name.localeCompare(b.name));

  return {
    framework: "msci",
    matched,
    issues,
    asOf: MSCI_AS_OF,
    note: matched.every((m) => m.matchLevel === "section")
      ? "no GICS sub-industry maps to these NIC Divisions — matched at the wider NIC Section"
      : null,
  };
}
