export interface Goal {
  id: string;
  label: string;
}

/**
 * 8 onboarding goals. Wording follows the deck's Title Case + outcomes-led
 * tone. Goals get passed to Learnyst via `utm_goals` so the school side
 * can personalize.
 */
export const goals: Goal[] = [
  { id: "career-pivot", label: "Pivot My Career into ESG" },
  { id: "framework-mastery", label: "Master Reporting Frameworks" },
  { id: "csr-strategy", label: "Build a CSR Strategy at My Company" },
  { id: "disclosure-readiness", label: "Get Disclosure-ready" },
  { id: "certification", label: "Earn a Recognized Certification" },
  { id: "cv-projects", label: "Add ESG Projects to My CV" },
  { id: "team-upskilling", label: "Upskill My Team" },
  { id: "exploration", label: "Just Exploring the Space" },
];
