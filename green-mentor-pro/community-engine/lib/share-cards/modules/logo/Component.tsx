"use client";

import { useEffect, useMemo } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import { getBrand } from "@/lib/header/brands";
import { wordmarkDataUri } from "@/lib/header/wordmark-uri";
import type { GmLogoConfig } from "./index";

/** `gmcard:logo` — the recolorable GreenMentor wordmark as a placeable layer
 *  (the same origin-free data-URI art the header studio exports). Size it with
 *  the layer's width transform. */
export default function LogoComponent({ config, noteReady }: VizRenderProps<GmLogoConfig>) {
  const src = useMemo(
    () => wordmarkDataUri(getBrand("greenmentor"), config.color.trim() || getBrand("greenmentor").nativeColor, config.fill),
    [config.color, config.fill]
  );

  useEffect(() => {
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [noteReady]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="GreenMentor" className="w-full" style={{ height: "auto" }} />;
}
