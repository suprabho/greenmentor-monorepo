/**
 * Confidence + outlier helpers shared by the runtime. Mirrors the EFDB/ls-ingestion
 * conventions: overall confidence = min of per-field; outlier = zero/negative/>3x median.
 */

const CONF_SCORE: Record<string, number> = { high: 0.9, medium: 0.6, low: 0.3 };

export function confToScore(c: string): number {
  return CONF_SCORE[c] ?? 0.3;
}

/** Min-of-per-field confidence over a list of "high"|"medium"|"low" values. */
export function overallConfidence(perField: string[]): "high" | "medium" | "low" {
  if (!perField.length) return "low";
  const min = Math.min(...perField.map(confToScore));
  if (min >= 0.9) return "high";
  if (min >= 0.6) return "medium";
  return "low";
}

/** EFDB outlier rule: zero, negative where impossible, or > factor x median. */
export function isOutlier(
  value: number,
  comparablePopulation: number[],
  opts: { allowZero?: boolean; factor?: number } = {},
): boolean {
  const factor = opts.factor ?? 3;
  if (value < 0) return true;
  if (value === 0 && !opts.allowZero) return true;
  const pop = comparablePopulation.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (pop.length === 0) return false;
  const mid = Math.floor(pop.length / 2);
  const median = pop.length % 2 ? pop[mid] : (pop[mid - 1] + pop[mid]) / 2;
  if (median <= 0) return false;
  return value > factor * median;
}

/** True if a confidence falls below the org floor and must route to human review. */
export function belowFloor(conf: string, floor = 0.6): boolean {
  return confToScore(conf) < floor;
}
