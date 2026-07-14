// Framework applicability engine — a faithful port of Document 6, Part 1
// (rules A1–A8). For each of the 7 frameworks the rule hierarchy is walked
// top-to-bottom, first match wins; then the Q18 confidence boost is applied to
// Likely/Possible outcomes. Pure and deterministic — asserted against the
// Document 6 test cases in __tests__/engine.test.ts.
//
// Representation note: each rule yields { confidence, whyTextKey, applies }.
// An `applies: false` outcome always renders as "Doesn't apply currently"
// (its confidence is confidence-in-the-non-applicability) and is NOT boost-
// eligible, matching Doc 6 §1.1 and §A8.

import {
  CBAM_SECTORS,
  CCTS_SECTORS,
  turnoverLowerCr,
} from "./questions";
import type {
  Answers,
  ApplicabilityIcon,
  ApplicabilityLabel,
  FrameworkKey,
  FrameworkResult,
} from "./types";
import { FRAMEWORK_LABELS } from "./types";

interface RuleOutcome {
  confidence: number;
  whyTextKey: string;
  /** true = an "applies" rule (Definite/Likely/Possible); false = doesn't-apply. */
  applies: boolean;
}

/** Derive the display label from confidence for an "applies" outcome (Doc 6 §1.1). */
export function labelFromConfidence(confidence: number): ApplicabilityLabel {
  if (confidence >= 90) return "Definite";
  if (confidence >= 70) return "Likely";
  return "Possible";
}

function iconFor(label: ApplicabilityLabel): ApplicabilityIcon {
  switch (label) {
    case "Definite":
      return "filled_green";
    case "Likely":
      return "filled_amber";
    case "Possible":
      return "half_grey";
    default:
      return "empty_grey";
  }
}

// --- small predicates shared across rules -------------------------------------
const exports = (a: Answers) => a.q5_exports; // "eu" | "non_eu" | "both" | "none"
const exportsToEU = (a: Answers) => a.q5_exports === "eu" || a.q5_exports === "both";
const hasExports = (a: Answers) => a.q5_exports !== "none";
const majorMnc = (a: Answers) => a.q7_mnc === "major";
const majorListedBuyer = (a: Answers) => a.q6_listed_buyer === "major_top250";
const listed = (a: Answers) =>
  a.q4_listed === "top_250" || a.q4_listed === "251_1000" || a.q4_listed === "beyond_1000";
const cr = (a: Answers) => turnoverLowerCr(a.q3_turnover);

// --- A1 BRSR (full) -----------------------------------------------------------
function ruleBRSR(a: Answers): RuleOutcome {
  if (a.q4_listed === "top_250" || a.q4_listed === "251_1000")
    return { confidence: 95, whyTextKey: "BRSR-1", applies: true };
  if (a.q4_listed === "beyond_1000")
    return { confidence: 85, whyTextKey: "BRSR-2", applies: true };
  if (a.q4_listed === "unlisted" && majorListedBuyer(a))
    return { confidence: 75, whyTextKey: "BRSR-3", applies: true };
  if (a.q4_listed === "unlisted" && cr(a) >= 250 && (hasExports(a) || majorMnc(a)))
    return { confidence: 60, whyTextKey: "BRSR-4", applies: true };
  return { confidence: 90, whyTextKey: "BRSR-5", applies: false };
}

// --- A2 BRSR Core -------------------------------------------------------------
function ruleBRSRCore(a: Answers): RuleOutcome {
  if (a.q4_listed === "top_250")
    return { confidence: 95, whyTextKey: "BRSRC-1", applies: true };
  if (a.q4_listed === "251_1000" && majorListedBuyer(a))
    return { confidence: 90, whyTextKey: "BRSRC-2", applies: true };
  if ((a.q4_listed === "unlisted" || a.q4_listed === "beyond_1000") && majorListedBuyer(a))
    return { confidence: 80, whyTextKey: "BRSRC-3", applies: true };
  if (a.q4_listed === "unlisted" && a.q6_listed_buyer === "minor_top250" && cr(a) >= 50)
    return { confidence: 60, whyTextKey: "BRSRC-4", applies: true };
  return { confidence: 85, whyTextKey: "BRSRC-5", applies: false };
}

// --- A3 CCTS ------------------------------------------------------------------
function ruleCCTS(a: Answers): RuleOutcome {
  const inSector = CCTS_SECTORS.has(a.q1_sector);
  if (inSector && cr(a) >= 1000) return { confidence: 80, whyTextKey: "CCTS-1", applies: true };
  if (inSector && a.q3_turnover === "500_1000")
    return { confidence: 60, whyTextKey: "CCTS-2", applies: true };
  if (inSector && cr(a) < 500) return { confidence: 75, whyTextKey: "CCTS-3", applies: false };
  return { confidence: 90, whyTextKey: "CCTS-4", applies: false };
}

// --- A4 CBAM ------------------------------------------------------------------
// NOTE — spec discrepancy: Doc 6 Test 1 expects CBAM "Doesn't apply 80%" for an
// EU-exporting, non-CBAM-sector company with a MAJOR MNC customer, but rule A4.2
// (below) matches that profile and yields "Possible 55%". Tests 2–4 are
// consistent with the rules; only Test 1/5's CBAM line conflicts. We implement
// the RULE (Possible), which is the precise, machine-readable spec, and flag the
// Test-1 expectation as the likely error. Confirm intended behaviour before launch.
function ruleCBAM(a: Answers): RuleOutcome {
  const eu = exportsToEU(a);
  const inSector = CBAM_SECTORS.has(a.q1_sector);
  if (eu && inSector) return { confidence: 95, whyTextKey: "CBAM-1", applies: true };
  if (eu && !inSector && majorMnc(a))
    return { confidence: 55, whyTextKey: "CBAM-2", applies: true };
  if (eu && !inSector) return { confidence: 80, whyTextKey: "CBAM-3", applies: false };
  return { confidence: 95, whyTextKey: "CBAM-4", applies: false };
}

// --- A5 GRI -------------------------------------------------------------------
function ruleGRI(a: Answers): RuleOutcome {
  if (listed(a) && (hasExports(a) || majorMnc(a)))
    return { confidence: 80, whyTextKey: "GRI-1", applies: true };
  if (
    a.q4_listed === "unlisted" &&
    cr(a) >= 250 &&
    (hasExports(a) || a.q7_mnc === "major" || a.q7_mnc === "minor")
  )
    return { confidence: 60, whyTextKey: "GRI-2", applies: true };
  if (cr(a) < 250 && exports(a) === "none" && (a.q7_mnc === "no" || a.q7_mnc === "not_sure"))
    return { confidence: 85, whyTextKey: "GRI-3", applies: false };
  return { confidence: 85, whyTextKey: "GRI-4", applies: false };
}

// --- A6 Organizational GHG Footprint -----------------------------------------
// GHG has no "doesn't apply" outcome; rule 3 is the Possible catch-all so the
// framework is always total.
function ruleGHG(a: Answers): RuleOutcome {
  const rule1 =
    a.q4_listed !== "unlisted" ||
    (hasExports(a) && cr(a) >= 50) ||
    majorMnc(a) ||
    majorListedBuyer(a);
  if (rule1) return { confidence: 95, whyTextKey: "GHG-1", applies: true };
  if (cr(a) >= 250) return { confidence: 75, whyTextKey: "GHG-2", applies: true };
  return { confidence: 55, whyTextKey: "GHG-3", applies: true };
}

// --- A7 Generic / Custom ESG Reporting ---------------------------------------
function ruleCustom(a: Answers): RuleOutcome {
  if (a.q7_mnc === "major") return { confidence: 90, whyTextKey: "CUSTOM-1", applies: true };
  if (a.q7_mnc === "minor") return { confidence: 75, whyTextKey: "CUSTOM-2", applies: true };
  if (hasExports(a) && (a.q7_mnc === "no" || a.q7_mnc === "not_sure") && cr(a) >= 250)
    return { confidence: 60, whyTextKey: "CUSTOM-3", applies: true };
  return { confidence: 80, whyTextKey: "CUSTOM-4", applies: false };
}

const RULES: Record<FrameworkKey, (a: Answers) => RuleOutcome> = {
  brsr_full: ruleBRSR,
  brsr_core: ruleBRSRCore,
  ccts: ruleCCTS,
  cbam: ruleCBAM,
  gri: ruleGRI,
  ghg: ruleGHG,
  custom_esg: ruleCustom,
};

/** Q18 confidence-boost amount in percentage points (Doc 6 §A8). */
export function q18BoostAmount(q18: string): number {
  if (q18 === "three_five") return 5;
  if (q18 === "more_than_five") return 10;
  return 0;
}

/**
 * Evaluate all 7 frameworks (rules A1–A7) then apply the Q18 boost (A8).
 * Returns results in the fixed FRAMEWORKS display order.
 */
export function evaluateApplicability(a: Answers): FrameworkResult[] {
  const boost = q18BoostAmount(a.q18_requests);

  return (Object.keys(RULES) as FrameworkKey[]).map((key) => {
    const outcome = RULES[key](a);

    let label: ApplicabilityLabel = outcome.applies
      ? labelFromConfidence(outcome.confidence)
      : "Doesn't apply currently";
    let confidence = outcome.confidence;
    let q18BoostApplied = false;

    // A8 — boost only Likely/Possible (i.e. applies-type, 50–89%). Cap at 95%,
    // then recompute the label so a crossed 70/90 threshold flips it.
    if (boost > 0 && outcome.applies && (label === "Likely" || label === "Possible")) {
      confidence = Math.min(confidence + boost, 95);
      label = labelFromConfidence(confidence);
      q18BoostApplied = true;
    }

    return {
      key,
      name: FRAMEWORK_LABELS[key],
      label,
      confidence,
      icon: iconFor(label),
      whyTextKey: outcome.whyTextKey,
      q18BoostApplied,
    };
  });
}
