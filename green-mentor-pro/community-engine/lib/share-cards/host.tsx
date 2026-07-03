"use client";

import type { ReactNode, Ref } from "react";
import {
  composerUid,
  DEFAULT_TRANSFORM,
  type ComposerHost,
  type ComposerLayer,
  type TransformLike,
} from "@vismay/viz-admin";
import { CardStage } from "./CardStage";
import {
  OUTPUT_SIZE,
  stageSizeFor,
  type CardFrame,
  type GmAspectRatio,
  type ShareCardData,
} from "./types";

/** Per-render context the composer shell threads to the frame + pickers. */
export interface GmComposerCtx {
  frame: CardFrame;
  ratio: GmAspectRatio;
  data: ShareCardData;
}

/** The `gmcard:*` types offered in the add-layer menu, with short layer names. */
export const GM_LAYER_TYPES: Array<{ type: string; name: string }> = [
  { type: "gmcard:article", name: "News article" },
  { type: "gmcard:headline", name: "Headline" },
  { type: "gmcard:image", name: "Image" },
  { type: "gmcard:entity-chips", name: "Entity tags" },
  { type: "gmcard:badge", name: "Badge" },
  { type: "gmcard:logo", name: "Wordmark" },
];

const NAME_BY_TYPE = new Map(GM_LAYER_TYPES.map((t) => [t.type, t.name]));

/** Default placement for a freshly added layer: the article card gets a large
 *  centered box; text/chips/badge/logo self-size from their width. */
function defaultTransform(type: string, ratio: GmAspectRatio): TransformLike {
  const out = OUTPUT_SIZE[ratio];
  const ar = out.w / out.h;
  switch (type) {
    case "gmcard:article":
      return { ...DEFAULT_TRANSFORM, widthPct: 84, heightPct: 62 };
    case "gmcard:image":
      return { ...DEFAULT_TRANSFORM, widthPct: 48, heightPct: 48 * ar };
    case "gmcard:headline":
      return { ...DEFAULT_TRANSFORM, widthPct: 80 };
    case "gmcard:entity-chips":
      return { ...DEFAULT_TRANSFORM, widthPct: 72 };
    case "gmcard:logo":
      return { ...DEFAULT_TRANSFORM, widthPct: 26 };
    case "gmcard:badge":
      return { ...DEFAULT_TRANSFORM, widthPct: 32 };
    default:
      return { ...DEFAULT_TRANSFORM, widthPct: 60, heightPct: 40 };
  }
}

/** Default picks for a freshly added layer. The article-driven layers inherit
 *  the newest article so they resolve to something immediately; the user
 *  re-picks in the config panel. */
function defaultConfig(type: string, ctx: GmComposerCtx): Record<string, unknown> {
  const firstArticle = ctx.data.articles[0]?.id ?? "";
  switch (type) {
    case "gmcard:article":
      return { type, articleId: firstArticle };
    case "gmcard:entity-chips":
      return { type, articleId: firstArticle };
    case "gmcard:image":
      return { type, src: ctx.data.articles.find((a) => a.image_url)?.image_url ?? "" };
    default:
      return { type };
  }
}

function GmPreviewFrame({
  ctx,
  body,
  captureRef,
}: {
  ctx: GmComposerCtx;
  body: ReactNode;
  captureRef?: Ref<HTMLDivElement>;
}) {
  return (
    <CardStage ref={captureRef} frame={ctx.frame} ratio={ctx.ratio} data={ctx.data}>
      {body}
    </CardStage>
  );
}

/** The GreenMentor share-card host: free-transform `gmcard:*` layers drawn
 *  inside the on-brand CardStage. Background stays a frame-level control, so
 *  the shell offers no background row. */
export const gmCardHost: ComposerHost<GmComposerCtx> = {
  id: "gm-sharecard",
  arrangement: "free",
  allowedModuleTypes: () => GM_LAYER_TYPES.map((t) => t.type),
  makeLayer: (type, ctx): ComposerLayer => ({
    id: composerUid("layer"),
    layer: defaultConfig(type, ctx) as unknown as ComposerLayer["layer"],
    name: NAME_BY_TYPE.get(type) ?? type,
    visible: true,
    transform: defaultTransform(type, ctx.ratio),
  }),
  backgroundOptions: () => [],
  cardSize: (ctx) => stageSizeFor(ctx.ratio),
  renderFrame: ({ ctx, body, captureRef }) => (
    <GmPreviewFrame ctx={ctx} body={body} captureRef={captureRef} />
  ),
};
