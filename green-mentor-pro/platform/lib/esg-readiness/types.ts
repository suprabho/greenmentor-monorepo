// Shared types for the ESG Applicability & Readiness engine.
//
// The engine is a faithful, deterministic port of lead-gen-amitava/Document 6
// (logic specification). It is pure (no I/O) so the Document 6 test cases can be
// asserted directly — see __tests__/engine.test.ts. Everything downstream (the
// assess API, results screen, PDF payload) consumes these types.

/** The seven frameworks, in the fixed display order used on-screen and in the PDF. */
export const FRAMEWORKS = [
  "brsr_full",
  "brsr_core",
  "ccts",
  "cbam",
  "gri",
  "ghg",
  "custom_esg",
] as const;
export type FrameworkKey = (typeof FRAMEWORKS)[number];

/** Human labels for each framework, in fixed order (Doc 3 / Doc 4). */
export const FRAMEWORK_LABELS: Record<FrameworkKey, string> = {
  brsr_full: "BRSR (full)",
  brsr_core: "BRSR Core",
  ccts: "CCTS",
  cbam: "CBAM",
  gri: "GRI",
  ghg: "Organizational GHG Footprint",
  custom_esg: "Custom / Buyer ESG Reporting",
};

/** Applicability display label, derived from confidence (Doc 6 §1.1). */
export type ApplicabilityLabel =
  | "Definite"
  | "Likely"
  | "Possible"
  | "Doesn't apply currently";

/** Icon token consumed by the results screen / PDF (Doc 3 / Doc 4). */
export type ApplicabilityIcon =
  | "filled_green" // Definite
  | "filled_amber" // Likely
  | "half_grey" // Possible
  | "empty_grey"; // Doesn't apply

export interface FrameworkResult {
  key: FrameworkKey;
  name: string;
  label: ApplicabilityLabel;
  confidence: number; // 50–95
  icon: ApplicabilityIcon;
  /** Rule ID that matched (e.g. "BRSR-3") — keys the why-text template. */
  whyTextKey: string;
  q18BoostApplied: boolean;
}

/** The four readiness sub-areas (Doc 6 §2.2). */
export type SubAreaKey = "A" | "B" | "C" | "D";

export const SUBAREA_LABELS: Record<SubAreaKey, string> = {
  A: "Data infrastructure",
  B: "People & knowledge",
  C: "Governance",
  D: "Output & pressure",
};

export type BandName =
  | "Critical Gap"
  | "Foundation Needed"
  | "Strengthen & Formalise"
  | "Advanced — Optimise & Assure";

export type BandColor = "red" | "amber" | "yellow-green" | "green";

export interface SubAreaScore {
  score: number;
  max: number;
}

export interface ReadinessResult {
  totalScore: number;
  maxScore: 44;
  band: BandName;
  bandColor: BandColor;
  bandTagline: string;
  subareas: Record<SubAreaKey, SubAreaScore>;
  /** Per-question scores, keyed "q8".."q18". */
  questionScores: Record<string, number>;
  weakestSubarea: SubAreaKey;
  /** Two lowest-scoring questions within the weakest sub-area (e.g. ["Q10","Q9"]). */
  weakestQuestions: string[];
  strongestSubarea: SubAreaKey;
}

export type EdgeCaseFlag = "none" | "all_doesnt_apply" | "advanced_band";

/**
 * Canonical answer shape. Values are stable option CODES (not display strings) —
 * see questions.ts for the code → label mappings. Multi-selects (Q8, Q17) are
 * arrays of codes. Q2 sub-sector is a free code or free text when Q1 = "other".
 */
export interface Answers {
  companyName: string;
  q1_sector: string;
  q2_subsector: string;
  q3_turnover: string;
  q4_listed: string;
  q5_exports: string;
  q6_listed_buyer: string;
  q7_mnc: string;
  q8_systems: string[];
  q9_scope12: string;
  q10_scope3: string;
  q11_owner: string;
  q12_training: string;
  q13_consultants: string;
  q14_supplier_data: string;
  q15_policy: string;
  q16_board: string;
  q17_outputs: string[];
  q18_requests: string;
}

/** Full computed result for one respondent. */
export interface AssessmentResult {
  frameworks: FrameworkResult[];
  readiness: ReadinessResult;
  edgeCaseFlag: EdgeCaseFlag;
}
