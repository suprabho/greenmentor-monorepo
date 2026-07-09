"use client";

import type { VizRenderProps } from "@vismay/viz-engine";
import type { StoryCtaConfig } from "./index";

const BRAND = "#0B602C";

export default function StoryCtaComponent({ config }: VizRenderProps<StoryCtaConfig>) {
  const { label, href, style } = config;

  if (style === "link") {
    return (
      <p className="my-1">
        <a href={href} className="font-semibold underline" style={{ color: BRAND }}>
          {`${label} →`}
        </a>
      </p>
    );
  }

  return (
    <div className="my-1 flex justify-center">
      <a
        href={href}
        className="inline-flex items-center rounded-pill px-5 py-2.5 text-[14px] font-semibold text-white"
        style={{ backgroundColor: BRAND }}
      >
        {label}
      </a>
    </div>
  );
}
