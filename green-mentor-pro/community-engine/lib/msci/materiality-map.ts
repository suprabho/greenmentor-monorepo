/**
 * MSCI ESG Industry Materiality Map — typed public API over the captured dataset.
 *
 * NOTE: this module is a per-app COPY of @gm/platform's lib/msci (same precedent
 * as lib/nic). ./materiality-data.ts is regenerated into both apps by the
 * platform generator (scripts/gen-msci-data.ts) — do not hand-edit either copy.
 *
 * ─── PROPRIETARY MSCI REFERENCE DATA — INTERNAL USE ONLY ──────────────────────
 * The taxonomy (Pillars → Themes → Key Issues) and the per-industry average Key
 * Issue weight matrix behind MSCI's ESG Industry Materiality Map
 * (https://www.msci.com/data-and-analytics/sustainability-solutions/esg-industry-materiality-map).
 * NOT for public display or redistribution. GICS® is jointly owned by MSCI & S&P.
 *
 * The bulk data lives in the GENERATED sibling ./materiality-data.ts (produced by
 * scripts/gen-msci-data.ts from an authenticated capture — see
 * scripts/extract-msci-materiality.ts). This module only shapes it into typed
 * structures + lookup helpers and self-checks the counts. To refresh annually:
 *   pnpm --filter @gm/platform msci:login   # once, to authenticate
 *   pnpm --filter @gm/platform msci:extract  # capture → scripts/.out/msci-raw.json
 *   pnpm --filter @gm/platform msci:gen      # regenerate ./materiality-data.ts
 *
 * Structure note: MSCI publishes 3 Pillars / 10 Themes. The map presents 34 Key
 * Issue rows = 27 Environmental+Social Key Issues (each individually weighted) +
 * 6 Governance sub-issues + 1 combined "Governance" rollup. Only 28 are weighted
 * (the 27 E/S issues + the Governance rollup); the 6 Governance sub-issues carry
 * weightIndex === null. See {@link keyIssueWeights}.
 */

// TODO: cross-walk MSCI_KEY_ISSUES → the E/S/G Pillar vocabulary in
// lib/brsr/topic-canon.ts (topic-canon uses "environment"; MSCI uses "environmental").

import {
  MSCI_ISSUES_RAW,
  MSCI_SECTORS_RAW,
  MSCI_SUBINDUSTRIES_RAW,
  WEIGHTED_ISSUE_ORDER,
  MSCI_WEIGHT_COLUMNS,
  MSCI_AS_OF,
  type MsciPillar,
} from "./materiality-data";

export type { MsciPillar };
export { WEIGHTED_ISSUE_ORDER, MSCI_WEIGHT_COLUMNS, MSCI_AS_OF };

export interface MsciKeyIssue {
  /** Stable slug id (e.g. "carbon-emissions") — the join key across the dataset. */
  id: string;
  name: string;
  description: string;
  /** MSCI's exact Theme name. */
  theme: string;
  pillar: MsciPillar;
  /** Column index into every industry's `weights`/`relevance` array, or null if unweighted. */
  weightIndex: number | null;
}

export interface MsciTheme {
  name: string;
  pillar: MsciPillar;
  keyIssues: MsciKeyIssue[];
}

export interface MsciIndustry {
  /** GICS code — 2 digits for a sector, 8 for a sub-industry. */
  gicsCode: string;
  name: string;
  level: "sector" | "sub-industry";
  /** Parent sector's 2-digit GICS code (equals gicsCode for a sector). */
  sectorCode: string;
  /** Average Key Issue weights (%), aligned to {@link WEIGHTED_ISSUE_ORDER}. Sums to ~100. */
  weights: readonly number[];
  /** Sub-industries only: 1 = Key Issue applies to all companies, 0 = company-specific. Empty for sectors. */
  relevance: readonly number[];
}

/** One material Key Issue for an industry (weight > 0), resolved against the taxonomy. */
export interface MsciIssueWeight {
  issue: MsciKeyIssue;
  /** Average weight (%) this Key Issue contributes to the industry's ESG Rating. */
  weight: number;
  /** Sub-industries only: MSCI applies this Key Issue to a subset of companies ("CS" marker). */
  companySpecific: boolean;
}

// ── taxonomy ──────────────────────────────────────────────────────────────────

/** All 34 Key Issue rows, in MSCI's render order. */
export const MSCI_KEY_ISSUES: MsciKeyIssue[] = MSCI_ISSUES_RAW.map(
  ([id, name, description, pillar, theme, weightIndex]) => ({
    id,
    name,
    description,
    pillar,
    theme,
    weightIndex,
  }),
);

export const MSCI_KEY_ISSUE_BY_ID: ReadonlyMap<string, MsciKeyIssue> = new Map(
  MSCI_KEY_ISSUES.map((k) => [k.id, k]),
);

/** The 10 Themes, in order, each carrying its Key Issues (consecutive same-name rows merged). */
export const MSCI_THEMES: MsciTheme[] = (() => {
  const themes: MsciTheme[] = [];
  for (const issue of MSCI_KEY_ISSUES) {
    let theme = themes[themes.length - 1];
    if (!theme || theme.name !== issue.theme) {
      theme = { name: issue.theme, pillar: issue.pillar, keyIssues: [] };
      themes.push(theme);
    }
    theme.keyIssues.push(issue);
  }
  return themes;
})();

export const MSCI_PILLARS: readonly MsciPillar[] = ["environmental", "social", "governance"];

// ── industries + weight matrix ─────────────────────────────────────────────────

export const MSCI_SECTORS: MsciIndustry[] = MSCI_SECTORS_RAW.map(([gicsCode, name, weights]) => ({
  gicsCode,
  name,
  level: "sector" as const,
  sectorCode: gicsCode,
  weights,
  relevance: [],
}));

export const MSCI_SUBINDUSTRIES: MsciIndustry[] = MSCI_SUBINDUSTRIES_RAW.map(
  ([gicsCode, name, sectorCode, weights, relevance]) => ({
    gicsCode,
    name,
    level: "sub-industry" as const,
    sectorCode,
    weights,
    relevance,
  }),
);

/** Every industry — sectors and sub-industries. */
export const MSCI_INDUSTRIES: MsciIndustry[] = [...MSCI_SECTORS, ...MSCI_SUBINDUSTRIES];

export const MSCI_INDUSTRY_BY_GICS: ReadonlyMap<string, MsciIndustry> = new Map(
  MSCI_INDUSTRIES.map((ind) => [ind.gicsCode, ind]),
);

/**
 * The material Key Issues for an industry — every weighted column with weight > 0,
 * resolved to its Key Issue and sorted by descending weight.
 */
export function keyIssueWeights(industry: MsciIndustry): MsciIssueWeight[] {
  const out: MsciIssueWeight[] = [];
  for (let col = 0; col < WEIGHTED_ISSUE_ORDER.length; col++) {
    const weight = industry.weights[col] ?? 0;
    if (weight <= 0) continue;
    const issue = MSCI_KEY_ISSUE_BY_ID.get(WEIGHTED_ISSUE_ORDER[col]);
    if (!issue) continue;
    const companySpecific = industry.level === "sub-industry" && industry.relevance[col] !== 1;
    out.push({ issue, weight, companySpecific });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Self-checking totals — counted off the data, never hand-written. */
export const MSCI_TOTALS = {
  pillars: new Set(MSCI_KEY_ISSUES.map((k) => k.pillar)).size,
  themes: MSCI_THEMES.length,
  keyIssues: MSCI_KEY_ISSUES.length,
  weightedKeyIssues: MSCI_KEY_ISSUES.filter((k) => k.weightIndex !== null).length,
  sectors: MSCI_SECTORS.length,
  subIndustries: MSCI_SUBINDUSTRIES.length,
} as const;
