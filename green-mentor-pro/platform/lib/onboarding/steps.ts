/**
 * Onboarding step order — the single source of truth for the progress meter,
 * the Back links, and the "resume where you left off" redirect on /onboarding.
 */
// The plan/subscription step is deferred for now. The profiles.plan_id and
// billing_cycle columns stay in place (see 0002_onboarding.sql), so restoring
// it later is a UI-only change.
export const ONBOARDING_STEPS = [
  "/onboarding/welcome",
  "/onboarding/audience",
  "/onboarding/goals",
] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number];

/** The shape of the profile row the wizard cares about. */
export interface OnboardingProfile {
  display_name: string | null;
  phone: string | null;
  phone_country: string | null;
  segment: string | null;
  goals: string[] | null;
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
  return "/onboarding/goals";
}
