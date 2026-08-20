/**
 * Turnover scale inference for BRSR filings.
 *
 * ~10% of filers report turnover in ₹ lakh or ₹ crore while the XBRL says
 * unitRef="INR", so the stored figure is a clean decimal shift off true rupees.
 * Nothing in the markup disambiguates it: unitRef is INR on every row, `decimals`
 * is precision not scale (PARAS and SAKSOFT both file decimals="2" at magnitudes
 * 1e5 apart), and XBRL 2.1 instances have no `scale` attribute at all — that
 * exists only in Inline XBRL.
 *
 * Nor do the BRSR Core intensity ratios help, tempting as they look: a filer
 * computes `metric ÷ turnover` against its OWN denominator, so the ratio is
 * co-scaled with whatever unit it used. PARAS FY2025 stores turnover 4.17e4 and
 * all four intensities imply 4.17e4 — internally consistent, still wrong. Where
 * intensity and turnover disagree there is no way to tell which side is right.
 *
 * What does work is two signals that can corroborate each other:
 *   cross-tag   Turnover vs TotalRevenueOfTheCompany in the same filing
 *   cross-year  the same company's filings that are already plausible
 * Where both are available they agree on the multiplier in 8 of 9 sampled cases,
 * and the multipliers cluster on 1e5 (lakh) and 1e7 (crore). This module snaps to
 * a real unit or gives up — it never scales by a bare ratio, because an arbitrary
 * multiplier is indistinguishable from a genuine difference in company size.
 */

/** Below ₹1 crore in rupees is implausible for an NSE-listed filer — the trigger
 * to investigate, never itself the correction. */
export const PLAUSIBLE_FLOOR = 1e8;

/** Unit conventions filers actually use. 1 must stay in the set: SUVEN FY2025
 * (7.11e7) sits under the floor yet only 0.25 dex from its own anchor — a
 * genuinely small company, and without 1 the snap would invent a rescale. */
export const UNIT_MULTIPLIERS = [1, 1e2, 1e5, 1e7] as const;

/** Residual (in orders of magnitude) a lone signal must land within to be trusted.
 * A single signal carries no corroboration, so it has to be tight. */
export const SINGLE_SIGNAL_TOLERANCE = 0.3;

export type ScaleSource = "as_filed" | "cross_tag" | "cross_year" | "both" | "unresolved";
export type ScaleConfidence = "high" | "medium" | "unresolved";

export type ScaleVerdict = {
  /** Factor to reach rupees; 1 when as-filed or unresolved. */
  multiplier: number;
  source: ScaleSource;
  confidence: ScaleConfidence;
};

export type ScaleInput = {
  /** turnover as filed. */
  filed: number;
  /** TotalRevenueOfTheCompany from the SAME filing, or null. */
  crossTag: number | null;
  /** log10 of this company's anchor turnover (median of its plausible years), or null. */
  anchorLog: number | null;
};

/** Nearest unit multiplier bringing `filed` to `targetLog`, with its residual. */
function snap(filed: number, targetLog: number): { multiplier: number; residual: number } {
  let best = { multiplier: 1, residual: Infinity };
  for (const multiplier of UNIT_MULTIPLIERS) {
    const residual = Math.abs(Math.log10(filed * multiplier) - targetLog);
    if (residual < best.residual) best = { multiplier, residual };
  }
  return best;
}

const UNRESOLVED: ScaleVerdict = { multiplier: 1, source: "unresolved", confidence: "unresolved" };

/**
 * Decide how to scale one turnover fact. Pure — the caller supplies both signals.
 *
 * A plausible value is never touched, so the common path (3705 of 4137 rows) is a
 * no-op. Otherwise the two signals vote; agreement is high confidence, a lone
 * tight signal is medium, and anything looser stays unresolved so the consumer can
 * treat revenue as unknown rather than wrong.
 */
export function inferScale({ filed, crossTag, anchorLog }: ScaleInput): ScaleVerdict {
  // Non-positive turnover is the fallbackTags problem, not a scale problem.
  if (!Number.isFinite(filed) || filed <= 0) return UNRESOLVED;
  if (filed >= PLAUSIBLE_FLOOR) return { multiplier: 1, source: "as_filed", confidence: "high" };

  // A cross-tag figure only anchors anything if it is itself plausible; two
  // lakh-denominated tags agreeing (PARAS FY2025) says nothing about the unit.
  const tag = crossTag !== null && Number.isFinite(crossTag) && crossTag >= PLAUSIBLE_FLOOR
    ? snap(filed, Math.log10(crossTag))
    : null;
  const year = anchorLog !== null && Number.isFinite(anchorLog) ? snap(filed, anchorLog) : null;

  if (tag && year) {
    if (tag.multiplier === year.multiplier && tag.multiplier !== 1) {
      return { multiplier: tag.multiplier, source: "both", confidence: "high" };
    }
    // Both signals agreeing on "no change" means the floor flagged a small company.
    if (tag.multiplier === 1 && year.multiplier === 1) {
      return { multiplier: 1, source: "as_filed", confidence: "high" };
    }
    return UNRESOLVED; // signals conflict — refuse rather than pick a winner
  }

  const lone = tag ?? year;
  if (!lone) return UNRESOLVED;
  if (lone.residual > SINGLE_SIGNAL_TOLERANCE) return UNRESOLVED;
  if (lone.multiplier === 1) return { multiplier: 1, source: "as_filed", confidence: "high" };
  return { multiplier: lone.multiplier, source: tag ? "cross_tag" : "cross_year", confidence: "medium" };
}

/** Median log10 of the plausible values — a company's scale anchor. Null when it
 * has no filing above the floor, which is the un-anchorable case. */
export function anchorLogOf(values: number[]): number | null {
  const logs = values.filter((v) => Number.isFinite(v) && v >= PLAUSIBLE_FLOOR).map((v) => Math.log10(v)).sort((a, b) => a - b);
  if (!logs.length) return null;
  return logs[Math.floor(logs.length / 2)];
}

/** Whether a verdict yields a number a consumer should use. */
export function isUsable(confidence: ScaleConfidence): boolean {
  return confidence === "high" || confidence === "medium";
}
