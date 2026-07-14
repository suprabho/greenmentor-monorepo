/**
 * BRSR disclosure-coverage scorecard — a deterministic, per-company score of how
 * completely a filing reports the curated BRSR Core indicators (tag-map.ts).
 *
 * This is a COVERAGE score (did the company disclose the indicator at all?), not
 * a PERFORMANCE score (are its emissions low?). Coverage is objective and needs
 * no peer cohort, so it ships against a single filing; performance benchmarking
 * against sector peers is a later layer that builds on the same brsr_indicators.
 *
 * Scores are matched/total × 100, rolled up three ways: overall, by ESG pillar,
 * and by the tag-map category. Input is the set of indicator keys a filing
 * actually reported — i.e. matchIndicators().coverage.matchedKeys, or the
 * distinct indicator_key values already stored in brsr_indicators.
 */

import { BRSR_TAG_MAP, type BrsrCategory } from "./tag-map";

export type Pillar = "environment" | "social" | "governance";

/** Which ESG pillar each tag-map category rolls up into. */
export const CATEGORY_PILLAR: Record<BrsrCategory, Pillar> = {
  emissions: "environment",
  energy: "environment",
  water: "environment",
  waste: "environment",
  safety: "social",
  workforce: "social",
  social: "social",
  // Turnover is the economic/governance denominator BRSR Core intensities hang
  // off of; it's the only non-E/S indicator we curate today.
  financial: "governance",
};

const PILLARS: readonly Pillar[] = ["environment", "social", "governance"];
const CATEGORIES: readonly BrsrCategory[] = [
  "emissions",
  "energy",
  "water",
  "waste",
  "safety",
  "workforce",
  "social",
  "financial",
];

export type ScoreBreakdown = {
  matched: number;
  total: number;
  /** matched/total × 100, rounded; 0 when the bucket has no curated keys. */
  score: number;
};

export type Scorecard = {
  overall: ScoreBreakdown;
  byPillar: Record<Pillar, ScoreBreakdown>;
  byCategory: Record<BrsrCategory, ScoreBreakdown>;
  matchedKeys: string[];
  missingKeys: string[];
};

// Category of each curated key, and the per-category/per-pillar totals — derived
// from the tag-map once so the denominators can't drift from what's extracted.
const KEY_CATEGORY = new Map<string, BrsrCategory>(BRSR_TAG_MAP.map((d) => [d.key, d.category]));

const breakdown = (matched: number, total: number): ScoreBreakdown => ({
  matched,
  total,
  score: total > 0 ? Math.round((matched / total) * 100) : 0,
});

/**
 * Build the coverage scorecard from the indicator keys a filing reported.
 * Unknown keys (not in the current tag-map) are ignored so an older stored
 * filing can't inflate the score above the current curated denominator.
 */
export function computeScorecard(reportedKeys: Iterable<string>): Scorecard {
  const present = new Set<string>();
  for (const k of reportedKeys) if (KEY_CATEGORY.has(k)) present.add(k);

  const catMatched = new Map<BrsrCategory, number>();
  const catTotal = new Map<BrsrCategory, number>();
  for (const def of BRSR_TAG_MAP) {
    catTotal.set(def.category, (catTotal.get(def.category) ?? 0) + 1);
    if (present.has(def.key)) catMatched.set(def.category, (catMatched.get(def.category) ?? 0) + 1);
  }

  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, breakdown(catMatched.get(c) ?? 0, catTotal.get(c) ?? 0)]),
  ) as Record<BrsrCategory, ScoreBreakdown>;

  const byPillar = Object.fromEntries(
    PILLARS.map((p) => {
      const cats = CATEGORIES.filter((c) => CATEGORY_PILLAR[c] === p);
      const matched = cats.reduce((n, c) => n + byCategory[c].matched, 0);
      const total = cats.reduce((n, c) => n + byCategory[c].total, 0);
      return [p, breakdown(matched, total)];
    }),
  ) as Record<Pillar, ScoreBreakdown>;

  const matchedKeys = BRSR_TAG_MAP.map((d) => d.key).filter((k) => present.has(k));
  const missingKeys = BRSR_TAG_MAP.map((d) => d.key).filter((k) => !present.has(k));

  return {
    overall: breakdown(present.size, BRSR_TAG_MAP.length),
    byPillar,
    byCategory,
    matchedKeys,
    missingKeys,
  };
}
