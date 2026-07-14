// Public entry point for the ESG Applicability & Readiness engine. `assess()`
// runs applicability (A1–A8) and readiness scoring, then derives the edge-case
// flag that selects PDF/on-screen variants (Doc 6 §4).

import { evaluateApplicability } from "./applicability";
import { calculateReadiness } from "./scoring";
import type { AssessmentResult, Answers, EdgeCaseFlag, FrameworkResult } from "./types";

// The six REGULATORY / stakeholder-driven frameworks. GHG is deliberately
// excluded from the "all doesn't apply" test: rule A6 has no "doesn't apply"
// outcome (its rule 3 is a Possible "voluntary baseline"), so GHG always
// applies at ≥55%. Doc 4's honesty paragraph confirms this intent — it still
// suggests "a basic GHG inventory as a sensible baseline" even when nothing
// else applies. Keying the edge case off these six makes the "all doesn't
// apply" case reachable, matching Doc 6 Test 2's intent.
// PENDING PRODUCT CONFIRMATION — see discrepancy note reported to the team.
const REGULATORY_FRAMEWORKS = ["brsr_full", "brsr_core", "ccts", "cbam", "gri", "custom_esg"];

function edgeCaseFlag(frameworks: FrameworkResult[], total: number): EdgeCaseFlag {
  const allDoesntApply = frameworks
    .filter((f) => REGULATORY_FRAMEWORKS.includes(f.key))
    .every((f) => f.label === "Doesn't apply currently");
  if (allDoesntApply) return "all_doesnt_apply";

  // Advanced band: total ≥ 34 AND at least 3 frameworks at Definite or Likely.
  const strong = frameworks.filter((f) => f.label === "Definite" || f.label === "Likely").length;
  if (total >= 34 && strong >= 3) return "advanced_band";

  return "none";
}

export function assess(answers: Answers): AssessmentResult {
  const frameworks = evaluateApplicability(answers);
  const readiness = calculateReadiness(answers);
  return {
    frameworks,
    readiness,
    edgeCaseFlag: edgeCaseFlag(frameworks, readiness.totalScore),
  };
}

export * from "./types";
export { evaluateApplicability, labelFromConfidence, q18BoostAmount } from "./applicability";
export { calculateReadiness, identifyWeakest, identifyStrongest } from "./scoring";
