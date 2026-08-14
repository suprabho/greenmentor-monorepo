"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

let initialized = false;

/** Initializes Amplitude analytics exactly once, client-side. */
export function AmplitudeInit() {
  useEffect(() => {
    if (initialized) return;
    const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    if (!apiKey) {
      console.warn("Amplitude API key missing — analytics disabled");
      return;
    }
    initialized = true;
    amplitude.initAll(apiKey, {
      analytics: {
        // Everything `autocapture: true` enables, minus Web Vitals.
        autocapture: {
          elementInteractions: true,
          networkTracking: true,
          frustrationInteractions: true,
          performanceTracking: true,
          webVitals: false,
        },
      },
      // Session replay (screen recording) off: sampleRate 0 records no sessions.
      sessionReplay: { sampleRate: 0 },
    });
  }, []);

  return null;
}
