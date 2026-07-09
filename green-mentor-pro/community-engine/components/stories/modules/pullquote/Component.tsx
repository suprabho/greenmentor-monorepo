"use client";

import type { VizRenderProps } from "@vismay/viz-engine";
import type { StoryPullquoteConfig } from "./index";

export default function StoryPullquoteComponent({ config }: VizRenderProps<StoryPullquoteConfig>) {
  const { text, attribution } = config;
  return (
    <blockquote className="border-l-4 pl-4" style={{ borderColor: "#0B602C" }}>
      <p className="text-[17px] font-medium italic leading-relaxed text-ink">{`“${text}”`}</p>
      {attribution ? (
        <footer className="mt-2 text-[13px] text-gray-500">{`— ${attribution}`}</footer>
      ) : null}
    </blockquote>
  );
}
