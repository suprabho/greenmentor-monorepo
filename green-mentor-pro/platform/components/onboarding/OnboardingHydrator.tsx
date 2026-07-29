"use client";

import { useEffect } from "react";
import { useOnboarding, type AudienceSegment, type BillingCycle } from "@/lib/store/onboarding";
import { fromE164 } from "@/lib/utils/validation";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import type { OnboardingProfile } from "@/lib/onboarding/steps";

/**
 * Seeds the client draft from the saved profile row on mount. Onboarding saves
 * as it advances, so this is what lets a half-finished flow resume on a device
 * whose localStorage is empty. `hydrateFrom` only fills blanks, so it can't
 * clobber an answer the user has already changed in this session.
 */
export function OnboardingHydrator({ profile }: { profile: OnboardingProfile | null }) {
  const hydrateFrom = useOnboarding((s) => s.hydrateFrom);

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
      planId: profile.plan_id ?? null,
      billingCycle: (profile.billing_cycle as BillingCycle | null) ?? undefined,
    });
  }, [profile, hydrateFrom]);

  return null;
}
