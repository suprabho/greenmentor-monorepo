"use client";

import type { VizRenderProps } from "@vismay/viz-engine";
import type { StoryImageConfig } from "./index";

export default function StoryImageComponent({ config }: VizRenderProps<StoryImageConfig>) {
  const { src, alt, caption } = config;
  return (
    <figure className="my-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URLs; not a Next-optimized asset */}
      <img src={src} alt={alt || caption} className="w-full rounded-lg" />
      {caption ? (
        <figcaption className="mt-2 text-center text-[12.5px] text-gray-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
