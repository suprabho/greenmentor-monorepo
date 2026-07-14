// The gating boundary (Doc 3). The results SCREEN may show framework labels +
// icons, the total score, and the band — nothing else. Confidence percentages,
// per-framework reasoning, and the sub-area breakdown are deliberately withheld
// (they are the lead-capture incentive, revealed only in the emailed PDF). This
// module produces the trimmed shape the /assess endpoint returns to the browser,
// so the sensitive fields never cross the wire.

import type { AssessmentResult } from "./types";

export interface GatedFramework {
  key: string;
  name: string;
  label: string; // Definite | Likely | Possible | Doesn't apply currently
  icon: string; // filled_green | filled_amber | half_grey | empty_grey
}

export interface GatedResult {
  company: { name: string; sectorLabel: string; subsectorLabel: string };
  frameworks: GatedFramework[];
  readiness: {
    totalScore: number;
    maxScore: number;
    band: string;
    bandColor: string;
    bandTagline: string;
  };
  edgeCaseFlag: string; // drives the all_doesnt_apply bullet-5 swap (Doc 3)
}

export function toGatedResult(
  result: AssessmentResult,
  company: { companyName: string; sectorLabel: string; subsectorLabel: string },
): GatedResult {
  return {
    company: {
      name: company.companyName,
      sectorLabel: company.sectorLabel,
      subsectorLabel: company.subsectorLabel,
    },
    frameworks: result.frameworks.map((f) => ({
      key: f.key,
      name: f.name,
      label: f.label,
      icon: f.icon,
    })),
    readiness: {
      totalScore: result.readiness.totalScore,
      maxScore: result.readiness.maxScore,
      band: result.readiness.band,
      bandColor: result.readiness.bandColor,
      bandTagline: result.readiness.bandTagline,
    },
    edgeCaseFlag: result.edgeCaseFlag,
  };
}
