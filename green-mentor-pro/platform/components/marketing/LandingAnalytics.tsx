"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";
import { track } from "@/lib/utils/analytics";

/**
 * Fires the landing-page view event. Split out of the page so the page itself
 * can stay a Server Component and read the course catalog from Supabase — the
 * course grid is primary marketing content and has to be in the server HTML.
 */
export function LandingAnalytics() {
  useEffect(() => {
    track("landing_viewed");
    amplitude.track("Viewed Home Page", { prompt_version: "BA400.4" }); // helps improve this setup flow — safe to remove once you've verified the event lands
  }, []);

  return null;
}
