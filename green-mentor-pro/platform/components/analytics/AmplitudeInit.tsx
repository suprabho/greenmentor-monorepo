"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

let initialized = false;

/** Initializes Amplitude analytics + session replay exactly once, client-side. */
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
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    });
  }, []);

  return null;
}
