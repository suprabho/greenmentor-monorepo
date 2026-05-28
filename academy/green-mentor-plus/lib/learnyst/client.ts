/**
 * Learnyst client — single seam between GreenMentor and Learnyst.
 *
 * v1 (current): soft handoff. We build a signup URL with prefill query params
 * and let Learnyst handle the rest.
 *
 * v2 (future): swap `buildHandoffUrl` to call our SSO endpoint, which calls
 * the Learnyst SSO API and returns a one-time authenticated URL. Call sites
 * stay identical.
 */

import { LEARNYST_SIGNUP_URL } from "./config";

export interface HandoffPayload {
  name: string;
  email: string;
  segment: "student" | "mid-career" | "business-leader" | null;
  planId: string | null;
  goals: string[];
}

/**
 * Build the redirect URL we send users to after onboarding completes.
 * Adds UTM and prefill params so Learnyst (or our v2 SSO endpoint) has
 * everything it needs to create the account.
 */
export function buildHandoffUrl(payload: HandoffPayload): string {
  const url = new URL(LEARNYST_SIGNUP_URL);

  url.searchParams.set("utm_source", "onboarding");
  url.searchParams.set("utm_medium", "web");
  url.searchParams.set("utm_campaign", "membership_launch");

  if (payload.segment) {
    url.searchParams.set("utm_segment", payload.segment);
  }
  if (payload.planId) {
    url.searchParams.set("utm_plan", payload.planId);
  }
  if (payload.email) {
    url.searchParams.set("prefill_email", payload.email);
  }
  if (payload.name) {
    url.searchParams.set("prefill_name", payload.name);
  }
  if (payload.goals.length > 0) {
    url.searchParams.set("utm_goals", payload.goals.join(","));
  }

  return url.toString();
}
