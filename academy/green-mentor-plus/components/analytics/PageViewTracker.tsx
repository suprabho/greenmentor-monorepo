"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendGAEvent } from "@next/third-parties/google";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * <GoogleAnalytics> and <MetaPixel> send the initial page_view, but App Router
 * client navigations (router.push between onboarding steps) don't reload the
 * scripts, so each step transition needs an explicit page_view. This fires one
 * on every path/query change for whichever trackers are configured.
 *
 * useSearchParams forces a Suspense boundary, so the effect lives in an inner
 * component wrapped below.
 */
function PageViewReporter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The initial script tags send the first page_view themselves — skip the
  // mount run so the initial load isn't counted twice.
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const query = searchParams.toString();
    const page_path = query ? `${pathname}?${query}` : pathname;

    if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      sendGAEvent("event", "page_view", { page_path });
    }
    if (process.env.NEXT_PUBLIC_META_PIXEL_ID) {
      window.fbq?.("track", "PageView");
    }
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
