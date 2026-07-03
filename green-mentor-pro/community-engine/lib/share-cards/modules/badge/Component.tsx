"use client";

import { useEffect, type CSSProperties } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import type { GmBadgeConfig } from "./index";

function toneStyle(tone: GmBadgeConfig["tone"]): CSSProperties {
  switch (tone) {
    case "outline":
      return {
        border: "2px solid var(--gmcard-accent)",
        color: "var(--gmcard-text)",
        background: "transparent",
      };
    case "glass":
      return {
        background: "rgba(127,127,127,0.2)",
        color: "var(--gmcard-text)",
        backdropFilter: "blur(4px)",
      };
    default:
      return { background: "var(--gmcard-accent)", color: "rgba(0,0,0,0.78)" };
  }
}

/** `gmcard:badge` — a single eyebrow-style pill (e.g. "ESG BRIEF", "CSRD"). */
export default function BadgeComponent({ config, noteReady }: VizRenderProps<GmBadgeConfig>) {
  useEffect(() => {
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [noteReady]);

  return (
    <div className="flex items-center">
      <span
        className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-[1.4px]"
        style={toneStyle(config.tone)}
      >
        {config.label}
      </span>
    </div>
  );
}
