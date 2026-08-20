/**
 * Deterministic peer-similarity scores over BRSR Section A data. Pure functions —
 * the peer-research agent receives these numbers from find_brsr_peer_candidates
 * and must not invent its own; LLM judgment only fills the market dimension when
 * filings lack markets-served data (pre-backfill, or sparse filers).
 *
 * All scores are 0–100 integers; null means "not computable from filings".
 */

/** One product/service row from brsr_company_activities. */
export interface ActivityShare {
  nicCode: string; // as filed, digits only
  divisionCode: string | null; // resolved NIC-2008 2-digit division
  turnover: number; // share of turnover as filed — fraction (0.94) OR percent (94)
}

/** Markets-served block (brsr_filings columns added by the markets migration). */
export interface MarketsProfile {
  plantsNational: number | null;
  officesNational: number | null;
  plantsInternational: number | null;
  officesInternational: number | null;
  statesServed: number | null;
  countriesServed: number | null;
  exportsPctTurnover: number | null; // 0..100
}

/**
 * Normalize activity turnover shares into a weight map summing to 1 over a key
 * (division, NIC group, …). Filers are inconsistent — some report fractions,
 * some percents — so weights are normalized by the column total rather than
 * assuming either convention. Rows whose key is null/empty are dropped.
 */
export function shareWeights(
  activities: ActivityShare[],
  key: (a: ActivityShare) => string | null,
): Map<string, number> {
  const weights = new Map<string, number>();
  let total = 0;
  for (const a of activities) {
    const k = key(a);
    const share = Number.isFinite(a.turnover) && a.turnover > 0 ? a.turnover : 0;
    if (!k || share <= 0) continue;
    weights.set(k, (weights.get(k) ?? 0) + share);
    total += share;
  }
  if (total <= 0) return new Map();
  for (const [k, w] of weights) weights.set(k, w / total);
  return weights;
}

/** Σ min(wA, wB) over shared keys — the overlap of two weight distributions, 0..1. */
function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let sum = 0;
  for (const [k, wa] of a) {
    const wb = b.get(k);
    if (wb) sum += Math.min(wa, wb);
  }
  return sum;
}

const byDivision = (a: ActivityShare) => a.divisionCode;
// NIC group = first 3 digits of the filed code; finer than division, coarser than class.
const byGroup = (a: ActivityShare) => {
  const digits = a.nicCode.replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : null;
};

/**
 * Business similarity: turnover-share-weighted overlap of NIC divisions (what
 * broad industries the revenue comes from), sharpened by overlap at NIC group
 * level (closer product match). Conglomerates compare segment-by-segment
 * instead of collapsing to one primary sector.
 */
export function businessSimilarity(a: ActivityShare[], b: ActivityShare[]): number | null {
  const divA = shareWeights(a, byDivision);
  const divB = shareWeights(b, byDivision);
  const grpA = shareWeights(a, byGroup);
  const grpB = shareWeights(b, byGroup);
  const hasDiv = divA.size > 0 && divB.size > 0;
  const hasGrp = grpA.size > 0 && grpB.size > 0;
  if (!hasDiv && !hasGrp) return null;
  if (!hasDiv) return Math.round(100 * overlap(grpA, grpB));
  if (!hasGrp) return Math.round(100 * overlap(divA, divB));
  return Math.round(100 * (0.6 * overlap(divA, divB) + 0.4 * overlap(grpA, grpB)));
}

/**
 * Revenue similarity: order-of-magnitude distance on absolute turnover. Equal
 * revenue → 100, 10× apart → 50, ≥100× apart → 0. Units must match (both ₹).
 */
export function revenueSimilarity(revA: number | null, revB: number | null): number | null {
  if (!revA || !revB || revA <= 0 || revB <= 0) return null;
  const dist = Math.abs(Math.log10(revA / revB));
  return Math.round(100 * Math.max(0, 1 - dist / 2));
}

/**
 * Market similarity from filed markets-served data: export intensity, whether
 * both operate internationally, and domestic footprint (states covered).
 * Averages whichever components both sides disclose; null when none overlap.
 */
export function marketSimilarity(a: MarketsProfile | null, b: MarketsProfile | null): number | null {
  if (!a || !b) return null;
  const parts: number[] = [];

  if (a.exportsPctTurnover != null && b.exportsPctTurnover != null) {
    parts.push(1 - Math.min(100, Math.abs(a.exportsPctTurnover - b.exportsPctTurnover)) / 100);
  }

  const intl = (m: MarketsProfile): boolean | null => {
    const signals = [m.plantsInternational, m.officesInternational];
    const countries = m.countriesServed;
    if (signals.every((s) => s == null) && countries == null) return null;
    return (signals.some((s) => (s ?? 0) > 0)) || (countries ?? 0) > 1;
  };
  const intlA = intl(a);
  const intlB = intl(b);
  if (intlA != null && intlB != null) parts.push(intlA === intlB ? 1 : 0.3);

  if (a.statesServed != null && b.statesServed != null && a.statesServed >= 0 && b.statesServed >= 0) {
    const dist = Math.abs(Math.log10((a.statesServed + 1) / (b.statesServed + 1)));
    parts.push(Math.max(0, 1 - dist));
  }

  if (!parts.length) return null;
  return Math.round((100 * parts.reduce((s, p) => s + p, 0)) / parts.length);
}

/**
 * Composite ranking score: business is the anchor, revenue and market refine it.
 * Dimensions that are null redistribute their weight over the ones present.
 */
export function overallScore(scores: {
  business: number | null;
  revenue: number | null;
  market: number | null;
}): number | null {
  const weighted: Array<[number, number]> = [];
  if (scores.business != null) weighted.push([scores.business, 0.5]);
  if (scores.revenue != null) weighted.push([scores.revenue, 0.25]);
  if (scores.market != null) weighted.push([scores.market, 0.25]);
  const totalW = weighted.reduce((s, [, w]) => s + w, 0);
  if (totalW <= 0) return null;
  return Math.round(weighted.reduce((s, [v, w]) => s + v * w, 0) / totalW);
}
