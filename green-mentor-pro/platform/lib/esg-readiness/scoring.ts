// Readiness scoring — a faithful port of Document 6, Parts 2 & 3. Produces the
// total score, band, four sub-area scores, and the weakest/strongest sub-area
// (with the 5pp proximity tie-break) plus the two lowest-scoring questions in
// the weakest area. Pure and deterministic.

import {
  Q9_SCOPE12,
  Q10_SCOPE3,
  Q11_OWNER,
  Q12_TRAINING,
  Q13_CONSULTANTS,
  Q14_SUPPLIER_DATA,
  Q15_POLICY,
  Q16_BOARD,
  Q18_REQUESTS,
  scoreMulti,
  scoreSingle,
} from "./questions";
import type {
  Answers,
  BandColor,
  BandName,
  ReadinessResult,
  SubAreaKey,
} from "./types";

interface BandSpec {
  name: BandName;
  tagline: string;
  color: BandColor;
}

/** Band boundaries (Doc 6 §2.3). Order matters — evaluated low→high. */
function bandFor(total: number): BandSpec {
  if (total <= 11)
    return { name: "Critical Gap", tagline: "Significant infrastructure to build.", color: "red" };
  if (total <= 22)
    return {
      name: "Foundation Needed",
      tagline: "Basics in place — formalisation required.",
      color: "amber",
    };
  if (total <= 33)
    return {
      name: "Strengthen & Formalise",
      tagline: "Clear direction — depth needed.",
      color: "yellow-green",
    };
  return {
    name: "Advanced — Optimise & Assure",
    tagline: "High maturity — focus on assurance and optimisation.",
    color: "green",
  };
}

const SUBAREA_QUESTIONS: Record<SubAreaKey, string[]> = {
  A: ["Q8", "Q9", "Q10"],
  B: ["Q11", "Q12", "Q13"],
  C: ["Q14", "Q15", "Q16"],
  D: ["Q17", "Q18"],
};

/**
 * Identify the weakest sub-area by percentage, with the proximity tie-break
 * (Doc 6 §3.2): candidates within 5pp of the minimum; drop D when it ties with
 * an A/B/C candidate; then pick in order A > B > C > D.
 */
export function identifyWeakest(pct: Record<SubAreaKey, number>): SubAreaKey {
  const min = Math.min(pct.A, pct.B, pct.C, pct.D);
  let candidates = (["A", "B", "C", "D"] as SubAreaKey[]).filter((k) => pct[k] <= min + 5);
  if (candidates.includes("D") && candidates.length > 1) {
    candidates = candidates.filter((k) => k !== "D");
  }
  for (const k of ["A", "B", "C", "D"] as SubAreaKey[]) {
    if (candidates.includes(k)) return k;
  }
  return "A"; // unreachable — candidates always non-empty
}

/** Highest-percentage sub-area, no proximity rule (Doc 6 §3.4). */
export function identifyStrongest(pct: Record<SubAreaKey, number>): SubAreaKey {
  const max = Math.max(pct.A, pct.B, pct.C, pct.D);
  for (const k of ["A", "B", "C", "D"] as SubAreaKey[]) {
    if (pct[k] === max) return k;
  }
  return "D";
}

/**
 * Two lowest-scoring questions within a sub-area, ascending by score with ties
 * broken by lower Q-number first (Doc 6 §3.3).
 */
function lowestQuestions(area: SubAreaKey, scores: Record<string, number>): string[] {
  const qs = SUBAREA_QUESTIONS[area];
  const sorted = [...qs].sort((x, y) => {
    const dx = scores[x.toLowerCase()] ?? 0;
    const dy = scores[y.toLowerCase()] ?? 0;
    if (dx !== dy) return dx - dy;
    return Number(x.slice(1)) - Number(y.slice(1));
  });
  return sorted.slice(0, 2);
}

export function calculateReadiness(a: Answers): ReadinessResult {
  const q8 = scoreMulti(a.q8_systems);
  const q9 = scoreSingle(Q9_SCOPE12, a.q9_scope12);
  const q10 = scoreSingle(Q10_SCOPE3, a.q10_scope3);
  const q11 = scoreSingle(Q11_OWNER, a.q11_owner);
  const q12 = scoreSingle(Q12_TRAINING, a.q12_training);
  const q13 = scoreSingle(Q13_CONSULTANTS, a.q13_consultants);
  const q14 = scoreSingle(Q14_SUPPLIER_DATA, a.q14_supplier_data);
  const q15 = scoreSingle(Q15_POLICY, a.q15_policy);
  const q16 = scoreSingle(Q16_BOARD, a.q16_board);
  const q17 = scoreMulti(a.q17_outputs);
  const q18 = scoreSingle(Q18_REQUESTS, a.q18_requests);

  const questionScores: Record<string, number> = {
    q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18,
  };

  const subA = q8 + q9 + q10;
  const subB = q11 + q12 + q13;
  const subC = q14 + q15 + q16;
  const subD = q17 + q18;
  const total = subA + subB + subC + subD;

  const subareas = {
    A: { score: subA, max: 12 },
    B: { score: subB, max: 12 },
    C: { score: subC, max: 12 },
    D: { score: subD, max: 8 },
  } as const;

  const pct: Record<SubAreaKey, number> = {
    A: (subA / 12) * 100,
    B: (subB / 12) * 100,
    C: (subC / 12) * 100,
    D: (subD / 8) * 100,
  };

  const weakest = identifyWeakest(pct);
  const strongest = identifyStrongest(pct);
  const band = bandFor(total);

  return {
    totalScore: total,
    maxScore: 44,
    band: band.name,
    bandColor: band.color,
    bandTagline: band.tagline,
    subareas,
    questionScores,
    weakestSubarea: weakest,
    weakestQuestions: lowestQuestions(weakest, questionScores),
    strongestSubarea: strongest,
  };
}
