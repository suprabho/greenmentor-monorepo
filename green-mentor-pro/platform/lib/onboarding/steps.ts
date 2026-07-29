/**
 * Onboarding step order — the single source of truth for the progress meter,
 * the Back links, and the "resume where you left off" redirect on /onboarding.
 */
export const ONBOARDING_STEPS = [
  "/onboarding/welcome",
  "/onboarding/audience",
  "/onboarding/goals",
  "/onboarding/plan",
] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number];

/** The shape of the profile row the wizard cares about. */
export interface OnboardingProfile {
  display_name: string | null;
  phone: string | null;
  phone_country: string | null;
  segment: string | null;
  goals: string[] | null;
  plan_id: string | null;
  billing_cycle: string | null;
  onboarded: boolean | null;
}

/**
 * First step the user hasn't answered yet. Onboarding saves as it advances, so
 * a half-finished flow resumes at the right place even on a new device where
 * the localStorage draft is empty.
 */
export function firstUnfinishedStep(
  profile: Partial<OnboardingProfile> | null | undefined,
): OnboardingStepPath {
  if (!profile?.display_name || !profile?.phone) return "/onboarding/welcome";
  if (!profile.segment) return "/onboarding/audience";
  if (!profile.goals || profile.goals.length === 0) return "/onboarding/goals";
  return "/onboarding/plan";
}
