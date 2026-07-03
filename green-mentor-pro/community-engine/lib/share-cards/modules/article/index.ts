import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmArticleSchema = z.object({
  type: z.literal("gmcard:article").default("gmcard:article"),
  articleId: z.string().describe("id of the news-pipe article this card renders").default(""),
  variant: z
    .enum(["text-led", "image-led", "compact"])
    .describe("text-led: headline+summary; image-led: photo on top; compact: small headline row")
    .default("text-led"),
  // `hide*` (not `show*`) because VizConfigForm's boolean field DELETES the key
  // when unchecked — a default(true) toggle could never be switched off.
  hideSummary: z.boolean().default(false),
  hideSource: z.boolean().default(false),
  hideDate: z.boolean().default(false),
  hideEntities: z.boolean().describe("hide the article's entity tag chips").default(false),
});

export type GmArticleConfig = z.output<typeof gmArticleSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "picker", key: "articleId", label: "Article", pickerId: "gm:article", required: true },
    {
      kind: "select",
      key: "variant",
      label: "Layout",
      options: [
        { value: "text-led", label: "Text-led" },
        { value: "image-led", label: "Image-led" },
        { value: "compact", label: "Compact" },
      ],
    },
    { kind: "boolean", key: "hideSource", label: "Hide source" },
    { kind: "boolean", key: "hideSummary", label: "Hide summary" },
    { kind: "boolean", key: "hideDate", label: "Hide date" },
    { kind: "boolean", key: "hideEntities", label: "Hide entity tags" },
  ];
}

const articleModule: VizModule<GmArticleConfig> = {
  type: "gmcard:article",
  label: "News article",
  slots: ["foreground"],
  schema: gmArticleSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmArticleSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
  stableIdentity: (c) => `gmcard:article:${c.articleId}`,
};

export default articleModule;
