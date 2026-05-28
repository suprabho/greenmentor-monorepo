/**
 * v1 analytics: fire-and-forget console logger. Swap the body for Mixpanel /
 * PostHog / Segment in v2 without changing call sites.
 */

export type AnalyticsEvent =
  | "landing_viewed"
  | "audience_card_clicked"
  | "pricing_cta_clicked"
  | "onboarding_step_completed"
  | "handoff_initiated"
  | "course_card_clicked"
  | "faq_opened"
  | "checkout_opened"
  | "checkout_succeeded"
  | "checkout_failed"
  | "checkout_dismissed"
  | "hiring_companies_expanded";

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, properties ?? {});
}
