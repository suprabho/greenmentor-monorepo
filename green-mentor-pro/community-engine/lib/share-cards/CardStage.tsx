"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { auraEmbedUrl } from "@/lib/header/types";
import { getBrand } from "@/lib/header/brands";
import { wordmarkDataUri } from "@/lib/header/wordmark-uri";
import { ShareCardDataProvider } from "./dataContext";
import { proxiedImage } from "./modules/shared";
import {
  stageSizeFor,
  themeVarsFor,
  type CardBackground,
  type CardFrame,
  type GmAspectRatio,
  type ShareCardData,
} from "./types";

/**
 * THE share-card surface — one component, three mounts that must stay
 * pixel-identical: the studio's live preview (via the ComposerHost's
 * renderFrame), the chrome-less /share-cards/render page, and the Playwright
 * screenshot the export API takes of that page. Renders at intrinsic
 * OUTPUT × CARD_RENDER_SCALE pixels; the preview CSS-scales it to fit and the
 * export recovers full output pixels via deviceScaleFactor.
 */

const BASE_LOGO_PX = 24;

function StageBackground({ background, scrim }: { background: CardBackground; scrim: number }) {
  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      {background.type === "aura" && (
        /* The LIVE aura — Playwright waits for it to settle and captures the
           real animation frame (header-studio approach; no poster needed). */
        <iframe
          src={auraEmbedUrl(background.slug)}
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          title=""
        />
      )}
      {background.type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedImage(background.src)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {scrim > 0 && background.type !== "none" && (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${scrim})` }} />
      )}
    </div>
  );
}

function StageChrome({ frame }: { frame: CardFrame }) {
  const brand = getBrand("greenmentor");
  const logoColor = frame.logo.color.trim() || brand.nativeColor;
  const logoH = Math.round(BASE_LOGO_PX * (frame.logo.scale || 1));
  return (
    <>
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-6">
        <span
          className="truncate text-[13px] font-bold uppercase tracking-[1.8px]"
          style={{ color: "var(--gmcard-muted)" }}
        >
          {frame.showEyebrow ? frame.eyebrow : " "}
        </span>
        {frame.showLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wordmarkDataUri(brand, logoColor, frame.logo.fill)}
            alt={brand.name}
            style={{ height: logoH, width: "auto" }}
          />
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-6 pb-6">
        <span className="text-[12.5px] font-medium" style={{ color: "var(--gmcard-muted)" }}>
          {frame.handle}
        </span>
        <span
          className="h-1.5 w-10 rounded-full"
          style={{ background: "var(--gmcard-accent)" }}
        />
      </div>
    </>
  );
}

export const CardStage = forwardRef<
  HTMLDivElement,
  {
    frame: CardFrame;
    ratio: GmAspectRatio;
    data: ShareCardData;
    /** The foreground layer canvas (PreviewPane's body, or StaticCardLayers). */
    children: ReactNode;
  }
>(function CardStage({ frame, ratio, data, children }, ref) {
  const size = stageSizeFor(ratio);
  const style: CSSProperties = {
    ...(themeVarsFor(frame) as CSSProperties),
    width: size.w,
    height: size.h,
    background: "var(--gmcard-bg)",
    color: "var(--gmcard-text)",
    fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
  };

  return (
    <div id="card-stage" ref={ref} className="relative overflow-hidden" style={style}>
      <StageBackground background={frame.background} scrim={frame.backgroundScrim} />
      <ShareCardDataProvider value={data}>
        {/* Free-positioned layer canvas — each layer absolutely placed by its transform. */}
        <div className="absolute inset-0 z-10">{children}</div>
        {/* Brand chrome above the layers so eyebrow + handle stay visible. */}
        <StageChrome frame={frame} />
      </ShareCardDataProvider>
    </div>
  );
});
