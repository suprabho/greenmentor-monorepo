/**
 * Finishing an RSVP that sign-in interrupted.
 *
 * Someone signed out who presses RSVP is sent to /login with `next` pointing at
 * the webinar's own page and carrying `?rsvp=1`. That param is the whole
 * mechanism: lib/auth/next-href.ts preserves query strings on `next` precisely
 * so an intent like this survives the round trip — through the login form, the
 * OAuth callback, and (for brand-new accounts) all three onboarding steps.
 *
 * The decision lives here rather than in the component for the same reason
 * getWebinarPhase does: it's the part worth testing, and the vitest suite is
 * node-only over lib/** (see vitest.config.ts), so a component effect can't be
 * covered. Client-safe — like lib/share/href and lib/webinars/contact, nothing
 * here reaches for next/headers or the server Supabase client.
 */

import { webinarHref } from "@/lib/share/href";
import { validateRsvpContact, type RsvpContactDefaults } from "@/lib/webinars/contact";

/** Marks a webinar URL as "they pressed RSVP before signing in". */
export const RESUME_PARAM = "rsvp";

/**
 * - `ignore`  — no pending intent; render normally.
 * - `submit`  — save the seat outright; the profile has everything the API needs.
 * - `collect` — something is missing, so show the prefilled form instead.
 */
export type RsvpResume = "ignore" | "submit" | "collect";

/** Where a signed-out RSVP click should come back to. */
export function rsvpResumeHref(shareSlug: string): string {
  return `${webinarHref({ shareSlug })}?${RESUME_PARAM}=1`;
}

/** The /login URL that carries both the destination and the intent. */
export function rsvpLoginHref(shareSlug: string): string {
  return `/login?next=${encodeURIComponent(rsvpResumeHref(shareSlug))}`;
}

export function decideRsvpResume(input: {
  /** Current location, split as window.location gives it. */
  pathname: string;
  search: string;
  shareSlug: string;
  signedIn: boolean;
  attending: boolean;
  contactDefaults: RsvpContactDefaults;
}): RsvpResume {
  const { pathname, search, shareSlug, signedIn, attending, contactDefaults } = input;

  // Already going? Nothing to resume — and re-firing would only churn the row.
  if (!signedIn || attending) return "ignore";
  if (new URLSearchParams(search).get(RESUME_PARAM) !== "1") return "ignore";

  // The param names no webinar, so only the one whose own page this is may act
  // on it. Both /home and /webinars render grids of cards; without this check a
  // stray `?rsvp=1` there would sign the user up for every webinar on screen.
  if (pathname !== webinarHref({ shareSlug })) return "ignore";

  // Onboarding already collects a name and phone and the email comes from the
  // session, so for most learners there is nothing left to ask. A profile
  // predating the phone column (migration 0025) falls back to the form rather
  // than failing the server-side validation silently.
  return Object.keys(validateRsvpContact(contactDefaults)).length === 0 ? "submit" : "collect";
}
