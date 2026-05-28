/**
 * v2 analytics: forwards every event to Google Analytics 4 via the official
 * @next/third-parties `sendGAEvent` helper (pushes to window.dataLayer).
 *
 * Call sites stay unchanged — swap the destination here to move to Mixpanel /
 * PostHog / Segment later. With NEXT_PUBLIC_GA_MEASUREMENT_ID unset, GA never
 * loads and this becomes a dev-only console logger.
 */

import { sendGAEvent } from "@next/third-parties/google";

export type AnalyticsEvent =
  | "landing_viewed"
  | "audience_card_clicked"
  | "pricing_cta_clicked"
  | "cta_clicked"
  | "onboarding_step_completed"
  | "handoff_initiated"
  | "course_card_clicked"
  | "faq_opened"
  | "begin_checkout"
  | "checkout_opened"
  | "purchase"
  | "checkout_succeeded"
  | "checkout_failed"
  | "checkout_dismissed"
  | "hiring_companies_expanded";

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, properties ?? {});
  }
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
  // `begin_checkout` and `purchase` are GA4-reserved ecommerce names — sending
  // them through here automatically populates GA4 Monetization reports.
  sendGAEvent("event", event, properties ?? {});
}
