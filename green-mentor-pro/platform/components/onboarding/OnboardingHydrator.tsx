"use client";

import { useEffect } from "react";
import { useOnboarding, type AudienceSegment } from "@/lib/store/onboarding";
import { safeNextHref } from "@/lib/auth/next-href";
import { fromE164 } from "@/lib/utils/validation";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import type { OnboardingProfile } from "@/lib/onboarding/steps";

/**
 * Seeds the client draft from the saved profile row on mount. Onboarding saves
 * as it advances, so this is what lets a half-finished flow resume on a device
 * whose localStorage is empty. `hydrateFrom` only fills blanks, so it can't
 * clobber an answer the user has already changed in this session.
 *
 * Also latches `?next=` into the store. The wizard navigates across three
 * routes before finishing, so the param has to be parked somewhere that
 * survives those hops — the persisted store already is that place. Read from
 * window.location rather than useSearchParams so no Suspense boundary is needed.
 */
export function OnboardingHydrator({ profile }: { profile: OnboardingProfile | null }) {
  const hydrateFrom = useOnboarding((s) => s.hydrateFrom);
  const setNextHref = useOnboarding((s) => s.setNextHref);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("next");
    if (!param) return; // a later step in the same flow — keep what we latched
    const href = safeNextHref(param, "");
    if (href) setNextHref(href);
  }, [setNextHref]);

  useEffect(() => {
    if (!profile) return;
    const iso = profile.phone_country ?? DEFAULT_COUNTRY_ISO;
    hydrateFrom({
      displayName: profile.display_name ?? "",
      // Stored E.164 → the national number the input expects.
      phone: fromE164(profile.phone, iso),
      phoneCountry: iso,
      segment: (profile.segment as AudienceSegment | null) ?? null,
      goals: profile.goals ?? [],
    });
  }, [profile, hydrateFrom]);

  return null;
}
