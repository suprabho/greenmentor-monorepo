import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmHeadlineSchema = z.object({
  type: z.literal("gmcard:headline").default("gmcard:headline"),
  text: z.string().describe("the display text").default("Sustainability, simplified."),
  size: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
  weight: z.enum(["medium", "semibold", "extrabold"]).default("extrabold"),
  align: z.enum(["left", "center", "right"]).default("left"),
  color: z
    .enum(["text", "accent", "muted"])
    .describe("theme token the text renders in")
    .default("text"),
});

export type GmHeadlineConfig = z.output<typeof gmHeadlineSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "text", key: "text", label: "Text", placeholder: "Headline…" },
    {
      kind: "select",
      key: "size",
      label: "Size",
      options: [
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
        { value: "xl", label: "Display" },
      ],
    },
    {
      kind: "select",
      key: "weight",
      label: "Weight",
      options: [
        { value: "medium", label: "Medium" },
        { value: "semibold", label: "Semibold" },
        { value: "extrabold", label: "Extrabold" },
      ],
    },
    {
      kind: "select",
      key: "align",
      label: "Align",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
    },
    {
      kind: "select",
      key: "color",
      label: "Color",
      options: [
        { value: "text", label: "Text" },
        { value: "accent", label: "Accent" },
        { value: "muted", label: "Muted" },
      ],
    },
  ];
}

const headlineModule: VizModule<GmHeadlineConfig> = {
  type: "gmcard:headline",
  label: "Headline / text",
  slots: ["foreground"],
  schema: gmHeadlineSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmHeadlineSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default headlineModule;
