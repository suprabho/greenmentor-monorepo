"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendGAEvent } from "@next/third-parties/google";

/**
 * <GoogleAnalytics> sends the initial page_view, but App Router client
 * navigations (router.push between onboarding steps) don't reload the script,
 * so each step transition needs an explicit page_view. This fires one on every
 * path/query change, making the funnel legible as a path sequence in GA4.
 *
 * useSearchParams forces a Suspense boundary, so the effect lives in an inner
 * component wrapped below.
 */
function PageViewReporter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // <GoogleAnalytics> sends the first page_view itself — skip the mount run so
  // the initial load isn't counted twice.
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
    const query = searchParams.toString();
    const page_path = query ? `${pathname}?${query}` : pathname;
    sendGAEvent("event", "page_view", { page_path });
  }, [pathname, searchParams]);

  return null;
}

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewReporter />
    </Suspense>
  );
}
