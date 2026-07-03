import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmChipsSchema = z.object({
  type: z.literal("gmcard:entity-chips").default("gmcard:entity-chips"),
  articleId: z.string().describe("article whose entity tags the chips show").default(""),
  max: z.number().min(1).max(12).describe("maximum chips shown").default(6),
  tone: z.enum(["glass", "solid", "outline"]).default("glass"),
});

export type GmChipsConfig = z.output<typeof gmChipsSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "picker", key: "articleId", label: "Article", pickerId: "gm:article", required: true },
    { kind: "number", key: "max", label: "Max chips", min: 1, max: 12, step: 1 },
    {
      kind: "select",
      key: "tone",
      label: "Tone",
      options: [
        { value: "glass", label: "Glass" },
        { value: "solid", label: "Solid accent" },
        { value: "outline", label: "Outline" },
      ],
    },
  ];
}

const chipsModule: VizModule<GmChipsConfig> = {
  type: "gmcard:entity-chips",
  label: "Entity tags",
  slots: ["foreground"],
  schema: gmChipsSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmChipsSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default chipsModule;
