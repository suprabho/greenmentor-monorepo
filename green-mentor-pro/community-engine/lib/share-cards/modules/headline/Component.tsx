"use client";

import { useEffect } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import type { GmHeadlineConfig } from "./index";

const SIZE_PX: Record<GmHeadlineConfig["size"], number> = { sm: 18, md: 26, lg: 36, xl: 50 };
const WEIGHT: Record<GmHeadlineConfig["weight"], number> = {
  medium: 500,
  semibold: 600,
  extrabold: 800,
};
const COLOR_VAR: Record<GmHeadlineConfig["color"], string> = {
  text: "var(--gmcard-text)",
  accent: "var(--gmcard-accent)",
  muted: "var(--gmcard-muted)",
};

/** `gmcard:headline` — free text over any background, themed via --gmcard-* vars. */
export default function HeadlineComponent({ config, noteReady }: VizRenderProps<GmHeadlineConfig>) {
  useEffect(() => {
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [noteReady]);

  return (
    <div
      style={{
        color: COLOR_VAR[config.color],
        fontSize: SIZE_PX[config.size],
        fontWeight: WEIGHT[config.weight],
        textAlign: config.align,
        lineHeight: 1.12,
        letterSpacing: "-0.01em",
        whiteSpace: "pre-wrap",
      }}
    >
      {config.text}
    </div>
  );
}
