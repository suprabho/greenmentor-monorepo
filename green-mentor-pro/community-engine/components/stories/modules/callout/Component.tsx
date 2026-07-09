"use client";

import { createElement } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import type { StoryCalloutConfig } from "./index";

const TONES = {
  info: { bg: "#ECFCEA", border: "#0B602C", text: "#014A50" },
  tip: { bg: "#DAF4D7", border: "#009C62", text: "#014A50" },
  warn: { bg: "#FFF4E0", border: "#FFB020", text: "#B25E00" },
} as const;

export default function StoryCalloutComponent({ config }: VizRenderProps<StoryCalloutConfig>) {
  const { title, items, ordered, tone } = config;
  const t = TONES[tone] ?? TONES.info;

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: t.bg, borderLeft: `4px solid ${t.border}` }}>
      {title ? (
        <div className="mb-2 text-[14px] font-semibold" style={{ color: t.text }}>
          {title}
        </div>
      ) : null}
      {createElement(
        ordered ? "ol" : "ul",
        { className: ordered ? "list-decimal pl-5" : "list-disc pl-5" },
        items.map((it, i) => (
          <li key={i} className="text-[14px] leading-relaxed text-gray-700">
            {it}
          </li>
        ))
      )}
    </div>
  );
}
