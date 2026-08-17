/**
 * Lightweight analytics shim for the platform marketing landing.
 *
 * Same `track(event, properties)` signature and `AnalyticsEvent` union as the
 * green-mentor-plus app, but with no GA/@next/third-parties coupling — it is a
 * dev-only console logger here. Swap the body to forward to GA4 / PostHog /
 * Segment when the platform wires up an analytics destination.
 */

import * as amplitude from "@amplitude/unified";

export type AnalyticsEvent =
  | "landing_viewed"
  | "audience_card_clicked"
  | "pricing_cta_clicked"
  | "cta_clicked"
  | "onboarding_step_completed"
  | "handoff_initiated"
  | "course_card_clicked"
  | "bundle_card_clicked"
  | "faq_opened"
  | "begin_checkout"
  | "checkout_opened"
  | "purchase"
  | "checkout_succeeded"
  | "checkout_failed"
  | "checkout_dismissed"
  | "hiring_companies_expanded"
  | "whatsapp_clicked"
  | "whatsapp_community_clicked";

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, properties ?? {});
  }
}

/**
 * Amplitude event for every navigation surface (desktop sidebar, mobile bottom
 * nav, mobile drawer, marketing header). One event, distinguished by `location`.
 */
export function trackNavClick(properties: {
  label: string;
  href: string;
  location: "sidebar" | "mobile_bottom_nav" | "mobile_drawer" | "marketing_nav" | "marketing_nav_mobile";
}): void {
  if (typeof window === "undefined") return;
  amplitude.track("Clicked Navigation Link", properties);
}
