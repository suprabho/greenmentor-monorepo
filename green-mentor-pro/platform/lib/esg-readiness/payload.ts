// Assemble the PDF report model (Doc 4 variable inventory) from the engine
// result, the respondent's answers, and the looked-up content. This is the
// single object the PDF template renders from.

import type { ContentBundle } from "./content";
import { SECTORS, TURNOVER_BANDS } from "./questions";
import type { Answers, AssessmentResult, SubAreaKey } from "./types";
import { SUBAREA_LABELS } from "./types";
import { buildWhyText, composeWhatThisMeans } from "./whyText";

export interface ReportFramework {
  name: string;
  label: string;
  confidence: number;
  icon: string;
  whyText: string;
  q18BoostApplied: boolean;
}

export interface ReportModel {
  companyName: string;
  sector: string;
  subsector: string;
  turnoverBand: string;
  reportDate: string;
  frameworks: ReportFramework[];
  readiness: {
    totalScore: number;
    maxScore: number;
    bandName: string;
    bandColor: string;
    bandTagline: string;
    subareas: { key: SubAreaKey; label: string; score: number; max: number }[];
    weakestSubarea: string;
    strongestSubarea: string;
    whatThisMeans: string;
  };
  bestPractices: { text: string; citation: string }[];
  peerBenefits: { category: string; label: string; body: string; citation: string }[];
  edgeCaseFlag: string;
}

const PEER_LABELS: Record<string, string> = {
  investor_banking: "Investor / banking",
  customer_market: "Customer / market access",
  compliance_risk: "Compliance / risk",
};

// Doc 4 edge case A — the honesty paragraph shown instead of "what this means"
// when no regulatory framework applies.
const ALL_DOESNT_APPLY_PARAGRAPH =
  "Based on your current profile — unlisted, no exports, no top-250 listed buyers, no global MNC customers — no ESG " +
  "reporting framework currently applies to your business. ESG infrastructure becomes relevant if you anticipate (a) " +
  "supplying to listed Indian companies or global MNCs, (b) entering EU exports, (c) raising debt or equity from " +
  "international lenders, or (d) crossing the ₹500 Cr turnover threshold. If none of these are on your horizon in the " +
  "next 24 months, ESG reporting is not a near-term priority for you. We'd still suggest a basic GHG inventory as a " +
  "sensible baseline that future-proofs you, but it isn't urgent.";

export function buildReportModel(
  result: AssessmentResult,
  answers: Answers,
  content: ContentBundle,
  reportDate: string,
): ReportModel {
  const sectorLabel = SECTORS.find((s) => s.code === answers.q1_sector)?.label ?? answers.q1_sector;
  const turnoverLabel =
    TURNOVER_BANDS.find((b) => b.code === answers.q3_turnover)?.label ?? answers.q3_turnover;

  const { readiness } = result;

  const whatThisMeans =
    result.edgeCaseFlag === "all_doesnt_apply"
      ? ALL_DOESNT_APPLY_PARAGRAPH
      : composeWhatThisMeans(readiness);

  return {
    companyName: answers.companyName,
    sector: sectorLabel,
    subsector: answers.q2_subsector,
    turnoverBand: turnoverLabel,
    reportDate,
    frameworks: result.frameworks.map((f) => ({
      name: f.name,
      label: f.label,
      confidence: f.confidence,
      icon: f.icon,
      whyText: buildWhyText(f),
      q18BoostApplied: f.q18BoostApplied,
    })),
    readiness: {
      totalScore: readiness.totalScore,
      maxScore: readiness.maxScore,
      bandName: readiness.band,
      bandColor: readiness.bandColor,
      bandTagline: readiness.bandTagline,
      subareas: (["A", "B", "C", "D"] as SubAreaKey[]).map((k) => ({
        key: k,
        label: SUBAREA_LABELS[k],
        score: readiness.subareas[k].score,
        max: readiness.subareas[k].max,
      })),
      weakestSubarea: SUBAREA_LABELS[readiness.weakestSubarea],
      strongestSubarea: SUBAREA_LABELS[readiness.strongestSubarea],
      whatThisMeans,
    },
    bestPractices: content.bestPractices.map((b) => ({ text: b.text, citation: b.citation })),
    peerBenefits: content.peerBenefits.map((p) => ({
      category: p.category,
      label: PEER_LABELS[p.category] ?? p.category,
      body: p.body,
      citation: p.citation,
    })),
    edgeCaseFlag: result.edgeCaseFlag,
  };
}
