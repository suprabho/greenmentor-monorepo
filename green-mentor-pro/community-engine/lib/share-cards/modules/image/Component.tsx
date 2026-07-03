"use client";

import { useEffect } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import { proxiedImage } from "../shared";
import type { GmImageConfig } from "./index";

const RADIUS_PX: Record<GmImageConfig["radius"], number> = { none: 0, md: 14, xl: 26 };

/** `gmcard:image` — a freely placed picture (article photo / URL / upload). */
export default function ImageComponent({ config, noteReady }: VizRenderProps<GmImageConfig>) {
  useEffect(() => {
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [noteReady]);

  if (!config.src) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-xl border border-dashed p-3 text-[12px]"
        style={{ color: "var(--gmcard-muted)", borderColor: "var(--gmcard-muted)" }}
      >
        Pick an image →
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedImage(config.src)}
      alt=""
      className="h-full w-full"
      style={{ objectFit: config.objectFit, borderRadius: RADIUS_PX[config.radius] }}
    />
  );
}
